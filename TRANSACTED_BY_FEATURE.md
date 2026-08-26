# Transacted By Feature

This update adds **Transacted By** to the Orders tab without changing the database schema.

The POS already saves the logged-in account ID in `pos_orders.created_by`.
The Orders API now securely resolves that user ID through Supabase Auth and returns the user's:
1. `full_name`
2. `name`
3. email username as a fallback

Older transactions with no saved `created_by` show **Not recorded**.

No SQL migration is required for this feature.
