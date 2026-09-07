-- PrintWise POS: hardened checkout integrity
-- Apply after supabase_atomic_pos_checkout.sql when Supabase write permissions are available.
-- This version prevents the browser from changing the authoritative sale total.

create or replace function public.create_printwise_pos_sale(
  p_order_no text,
  p_customer_name text,
  p_subtotal numeric,
  p_discount_type text,
  p_discount_value numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_amount_paid numeric,
  p_created_by uuid,
  p_payment_channel text,
  p_transaction_no text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_item_subtotal numeric := 0;
  v_client_subtotal numeric := round(coalesce(p_subtotal, 0), 2);
  v_client_discount numeric := round(coalesce(p_discount_amount, 0), 2);
  v_client_total numeric := round(coalesce(p_total, 0), 2);
  v_computed_total numeric;
  v_line_total numeric;
  v_quantity numeric;
  v_unit_price numeric;
  v_product_id uuid;
  v_payment_channel text;
begin
  if auth.uid() is null or auth.uid() <> p_created_by then
    raise exception 'Unauthorized checkout request';
  end if;

  if not public.printwise_user_can_pos_checkout(auth.uid()) then
    raise exception 'POS checkout is not permitted for this account';
  end if;

  if nullif(trim(coalesce(p_order_no, '')), '') is null then
    raise exception 'Order number is required';
  end if;

  if nullif(trim(coalesce(p_transaction_no, '')), '') is null then
    raise exception 'Transaction number is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required';
  end if;

  if v_client_subtotal < 0 or v_client_discount < 0 or v_client_total < 0 or round(coalesce(p_amount_paid, 0), 2) < 0 then
    raise exception 'Invalid sale amounts';
  end if;

  if v_client_discount > v_client_subtotal then
    raise exception 'Discount cannot exceed subtotal';
  end if;

  v_payment_channel := lower(trim(coalesce(p_payment_channel, '')));
  if v_payment_channel not in ('cash', 'gcash', 'bayad', 'bank') then
    raise exception 'Unsupported payment channel';
  end if;

  -- Recompute every line from quantity x unit price. The client may display totals,
  -- but it is not trusted as the accounting source of truth.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(trim(coalesce(v_item->>'item_name', '')), '') is null then
      raise exception 'An order item is missing its name';
    end if;

    begin
      v_quantity := (v_item->>'quantity')::numeric;
      v_unit_price := (v_item->>'unit_price')::numeric;
    exception when invalid_text_representation then
      raise exception 'Order item quantity and price must be numeric';
    end;

    if v_quantity <= 0 then
      raise exception 'Order item quantity must be greater than zero';
    end if;

    if v_unit_price < 0 then
      raise exception 'Order item price cannot be negative';
    end if;

    if v_quantity <> round(v_quantity, 6) or v_unit_price <> round(v_unit_price, 2) then
      raise exception 'Invalid order item precision';
    end if;

    v_line_total := round(v_quantity * v_unit_price, 2);
    v_item_subtotal := v_item_subtotal + v_line_total;

    if nullif(v_item->>'product_id', '') is not null then
      begin
        v_product_id := (v_item->>'product_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid product id';
      end;
    else
      v_product_id := null;
    end if;
  end loop;

  v_item_subtotal := round(v_item_subtotal, 2);
  v_computed_total := round(v_item_subtotal - v_client_discount, 2);

  if abs(v_item_subtotal - v_client_subtotal) > 0.01 then
    raise exception 'Subtotal does not match order items';
  end if;

  if abs(v_computed_total - v_client_total) > 0.01 then
    raise exception 'Total does not match order items and discount';
  end if;

  if round(coalesce(p_amount_paid, 0), 2) < v_client_total then
    raise exception 'Amount paid is not enough';
  end if;

  -- Unique indexes remain the final race-safe guard against duplicate identifiers.
  if exists (select 1 from public.pos_orders where order_no = trim(p_order_no)) then
    raise exception 'Order number already exists';
  end if;

  if exists (select 1 from public.payment_transactions where transaction_no = trim(p_transaction_no)) then
    raise exception 'Transaction number already exists';
  end if;

  insert into public.pos_orders (
    order_no, customer_name, status, subtotal, discount_type, discount_value,
    discount_amount, total, amount_paid, balance, created_by
  ) values (
    trim(p_order_no),
    nullif(trim(coalesce(p_customer_name, '')), ''),
    'completed',
    v_item_subtotal,
    nullif(trim(coalesce(p_discount_type, '')), ''),
    coalesce(p_discount_value, 0),
    v_client_discount,
    v_client_total,
    round(coalesce(p_amount_paid, 0), 2),
    greatest(0, round(v_client_total - round(coalesce(p_amount_paid, 0), 2), 2)),
    p_created_by
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_total := round(v_quantity * v_unit_price, 2);

    insert into public.pos_order_items (
      pos_order_id, product_id, item_name, unit_price, quantity, line_total
    ) values (
      v_order_id,
      case when nullif(v_item->>'product_id', '') is null then null else (v_item->>'product_id')::uuid end,
      trim(v_item->>'item_name'),
      v_unit_price,
      v_quantity,
      v_line_total
    );
  end loop;

  insert into public.payment_transactions (
    transaction_no, pos_order_id, channel, transaction_type, amount,
    service_fee, customer_name, status, created_by
  ) values (
    trim(p_transaction_no),
    v_order_id,
    v_payment_channel,
    'payment',
    v_client_total,
    0,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    'successful',
    p_created_by
  );

  return jsonb_build_object('ok', true, 'order_id', v_order_id);
end;
$$;

revoke all on function public.create_printwise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) from public;
grant execute on function public.create_printwise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) to authenticated;
