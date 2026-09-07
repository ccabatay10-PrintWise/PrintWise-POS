-- PrintWise POS: atomic checkout + inventory deduction
-- Apply supabase_inventory_control.sql and supabase_inventory_sales_control.sql first.

create or replace function public.printwise_user_can_pos_checkout(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and coalesce(p.is_active, true) = true
      and lower(coalesce(p.role, '')) in ('admin','staff','cashier')
  );
$$;

revoke all on function public.printwise_user_can_pos_checkout(uuid) from public;
grant execute on function public.printwise_user_can_pos_checkout(uuid) to authenticated;

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
  v_product_id uuid;
  v_quantity numeric;
  v_inventory_id uuid;
  v_before numeric;
  v_after numeric;
  v_inventory_movements integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_created_by then
    raise exception 'Unauthorized checkout request';
  end if;
  if not public.printwise_user_can_pos_checkout(auth.uid()) then
    raise exception 'POS checkout is not permitted for this account';
  end if;
  if nullif(trim(coalesce(p_order_no,'')), '') is null then raise exception 'Order number is required'; end if;
  if nullif(trim(coalesce(p_transaction_no,'')), '') is null then raise exception 'Transaction number is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  if coalesce(p_subtotal,0) < 0 or coalesce(p_discount_amount,0) < 0 or coalesce(p_total,0) < 0 or coalesce(p_amount_paid,0) < 0 then raise exception 'Invalid sale amounts'; end if;
  if p_total > p_amount_paid then raise exception 'Amount paid is not enough'; end if;

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
    trim(p_order_no), nullif(trim(coalesce(p_customer_name,'')), ''), 'completed',
    coalesce(p_subtotal,0), nullif(trim(coalesce(p_discount_type,'')), ''), coalesce(p_discount_value,0),
    coalesce(p_discount_amount,0), coalesce(p_total,0), coalesce(p_amount_paid,0),
    greatest(0, coalesce(p_total,0) - coalesce(p_amount_paid,0)), p_created_by
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(trim(coalesce(v_item->>'item_name','')), '') is null then raise exception 'An order item is missing its name'; end if;
    if coalesce((v_item->>'quantity')::numeric,0) <= 0 then raise exception 'Order item quantity must be greater than zero'; end if;
    if coalesce((v_item->>'unit_price')::numeric,0) < 0 then raise exception 'Order item price cannot be negative'; end if;

    v_product_id := nullif(trim(v_item->>'product_id'), '')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    insert into public.pos_order_items (
      pos_order_id, product_id, item_name, unit_price, quantity, line_total
    ) values (
      v_order_id,
      v_product_id,
      trim(v_item->>'item_name'),
      coalesce((v_item->>'unit_price')::numeric,0),
      v_quantity,
      coalesce((v_item->>'line_total')::numeric,0)
    );

    -- Every sellable POS product must have an explicit inventory mapping.
    -- The row lock prevents concurrent checkouts from overselling stock.
    if v_product_id is null then
      raise exception 'Product mapping is required for inventory-controlled POS items';
    end if;

    select id, quantity
      into v_inventory_id, v_before
    from public.inventory_items
    where product_id = v_product_id
      and coalesce(is_active, true) = true
    for update;

    if v_inventory_id is null then
      raise exception 'No active inventory mapping exists for product %', v_product_id;
    end if;

    if v_before < v_quantity then
      raise exception 'Insufficient inventory for product %: available %, required %', v_product_id, v_before, v_quantity;
    end if;

    v_after := v_before - v_quantity;

    update public.inventory_items
    set quantity = v_after
    where id = v_inventory_id;

    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      quantity_before,
      quantity_after,
      reference_type,
      reference_id,
      notes,
      created_by
    ) values (
      v_inventory_id,
      'sale',
      -v_quantity,
      v_before,
      v_after,
      'pos_order',
      v_order_id,
      'POS sale inventory deduction',
      p_created_by
    );

    v_inventory_movements := v_inventory_movements + 1;
  end loop;

  insert into public.payment_transactions (
    transaction_no, pos_order_id, channel, transaction_type, amount,
    service_fee, customer_name, status, created_by
  ) values (
    trim(p_transaction_no), v_order_id, lower(trim(p_payment_channel)), 'payment',
    coalesce(p_total,0), 0, nullif(trim(coalesce(p_customer_name,'')), ''), 'successful', p_created_by
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'inventory_movement_count', v_inventory_movements
  );
end;
$$;

revoke all on function public.create_printwise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) from public;
grant execute on function public.create_printwise_pos_sale(text,text,numeric,text,numeric,numeric,numeric,numeric,uuid,text,text,jsonb) to authenticated;

create unique index if not exists pos_orders_order_no_unique_idx on public.pos_orders(order_no);
create unique index if not exists payment_transactions_transaction_no_unique_idx on public.payment_transactions(transaction_no);
