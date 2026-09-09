-- Restore the current WISE POS catalog configuration: all active catalog items are enabled for POS.
update public.products
set is_active = true,
    show_in_pos = true
where is_active = true;
