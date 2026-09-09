-- Keep WISE POS checkout totals and payment channels authoritative at the database boundary.
CREATE OR REPLACE FUNCTION public.create_wise_pos_sale(p_order_no text, p_customer_name text, p_subtotal numeric, p_discount_type text, p_discount_value numeric, p_discount_amount numeric, p_total numeric, p_amount_paid numeric, p_created_by uuid, p_payment_channel text, p_transaction_no text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_order_id uuid; v_item jsonb; v_product_id uuid; v_quantity numeric; v_unit_price numeric; v_line_total numeric; v_inventory_id uuid; v_before numeric; v_after numeric; v_inventory_movements integer := 0; v_calc_subtotal numeric := 0; v_calc_total numeric := 0; v_track_inventory boolean; v_product_active boolean; v_show_in_pos boolean; v_channel text;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() <> p_created_by THEN RAISE EXCEPTION 'Unauthorized checkout request'; END IF;
 IF NOT public.wise_user_can_checkout(auth.uid()) THEN RAISE EXCEPTION 'POS checkout is not permitted for this account'; END IF;
 IF NULLIF(trim(p_order_no),'') IS NULL OR NULLIF(trim(p_transaction_no),'') IS NULL THEN RAISE EXCEPTION 'Order and transaction numbers are required'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'At least one item is required'; END IF;
 IF COALESCE(p_subtotal,0)<0 OR COALESCE(p_discount_amount,0)<0 OR COALESCE(p_total,0)<0 OR COALESCE(p_amount_paid,0)<0 THEN RAISE EXCEPTION 'Invalid sale amounts'; END IF;
 IF p_total > p_amount_paid THEN RAISE EXCEPTION 'Amount paid is not enough'; END IF;
 IF EXISTS (SELECT 1 FROM public.pos_orders WHERE order_no=trim(p_order_no)) THEN RAISE EXCEPTION 'Order number already exists'; END IF;
 IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE transaction_no=trim(p_transaction_no)) THEN RAISE EXCEPTION 'Transaction number already exists'; END IF;
 v_channel := lower(trim(COALESCE(p_payment_channel,'cash')));
 IF v_channel NOT IN ('cash','gcash','bayad_center','bank_transfer','other') THEN v_channel := 'other'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_product_id := NULLIF(trim(COALESCE(v_item->>'product_id','')),'')::uuid;
  v_quantity := COALESCE((v_item->>'quantity')::numeric,0);
  v_unit_price := COALESCE((v_item->>'unit_price')::numeric,0);
  IF v_product_id IS NULL OR v_quantity <= 0 OR v_unit_price < 0 THEN RAISE EXCEPTION 'Invalid product, quantity, or price in order'; END IF;
  SELECT COALESCE(is_active,true), COALESCE(show_in_pos,false), COALESCE(track_inventory,false) INTO v_product_active,v_show_in_pos,v_track_inventory FROM public.products WHERE id=v_product_id;
  IF NOT FOUND OR NOT v_product_active OR NOT v_show_in_pos THEN RAISE EXCEPTION 'Product is not active or enabled for POS: %',v_product_id; END IF;
  v_calc_subtotal := v_calc_subtotal + v_unit_price*v_quantity;
 END LOOP;
 IF abs(v_calc_subtotal - COALESCE(p_subtotal,0)) > 0.01 THEN RAISE EXCEPTION 'Checkout subtotal does not match item totals'; END IF;
 v_calc_total := greatest(0,v_calc_subtotal-COALESCE(p_discount_amount,0));
 IF abs(v_calc_total-COALESCE(p_total,0)) > 0.01 THEN RAISE EXCEPTION 'Checkout total does not match item totals'; END IF;
 INSERT INTO public.pos_orders(order_no,customer_name,status,subtotal,discount_type,discount_value,discount_amount,total,amount_paid,balance,created_by)
 VALUES(trim(p_order_no),NULLIF(trim(COALESCE(p_customer_name,'')),''),'completed',v_calc_subtotal,NULLIF(trim(COALESCE(p_discount_type,'')),''),COALESCE(p_discount_value,0),COALESCE(p_discount_amount,0),v_calc_total,COALESCE(p_amount_paid,0),greatest(0,v_calc_total-COALESCE(p_amount_paid,0)),p_created_by) RETURNING id INTO v_order_id;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_product_id := NULLIF(trim(COALESCE(v_item->>'product_id','')),'')::uuid; v_quantity := (v_item->>'quantity')::numeric; v_unit_price := (v_item->>'unit_price')::numeric; v_line_total := v_unit_price*v_quantity;
  SELECT COALESCE(track_inventory,false) INTO v_track_inventory FROM public.products WHERE id=v_product_id;
  v_inventory_id := NULL; v_before := NULL;
  IF v_track_inventory THEN
    SELECT ii.id,ii.quantity INTO v_inventory_id,v_before FROM public.inventory_items ii WHERE ii.product_id=v_product_id AND COALESCE(ii.is_active,true)=true FOR UPDATE;
    IF v_inventory_id IS NULL THEN RAISE EXCEPTION 'No active inventory mapping exists for product %',v_product_id; END IF;
    IF v_before < v_quantity THEN RAISE EXCEPTION 'Insufficient inventory for product %: available %, required %',v_product_id,v_before,v_quantity; END IF;
    v_after := v_before-v_quantity;
    UPDATE public.inventory_items SET quantity=v_after,updated_at=now() WHERE id=v_inventory_id;
  END IF;
  INSERT INTO public.pos_order_items(pos_order_id,product_id,item_name,unit_price,quantity,line_total) VALUES(v_order_id,v_product_id,trim(v_item->>'item_name'),v_unit_price,v_quantity,v_line_total);
  IF v_inventory_id IS NOT NULL THEN INSERT INTO public.inventory_movements(inventory_item_id,movement_type,quantity,quantity_before,quantity_after,reference_type,reference_id,notes,created_by) VALUES(v_inventory_id,'sale',-v_quantity,v_before,v_after,'wise_pos_order',v_order_id,'WISE POS sale inventory deduction',p_created_by); v_inventory_movements:=v_inventory_movements+1; END IF;
 END LOOP;
 INSERT INTO public.payment_transactions(transaction_no,pos_order_id,channel,transaction_type,amount,service_fee,customer_name,status,created_by) VALUES(trim(p_transaction_no),v_order_id,v_channel,'payment',v_calc_total,0,NULLIF(trim(COALESCE(p_customer_name,'')),''),'successful',p_created_by);
 RETURN jsonb_build_object('ok',true,'order_id',v_order_id,'inventory_movement_count',v_inventory_movements,'payment_channel',v_channel);
END;
$function$;
