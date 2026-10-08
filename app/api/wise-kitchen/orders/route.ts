import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function auth(req: NextRequest) {
  if (!url || !anon || !service) throw new Error("Supabase server configuration is missing.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Authentication required");
  const admin = createClient(url, service);
  const { data: p } = await admin.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (!p?.is_active || !["admin", "staff", "cashier"].includes(p.role)) throw new Error("Not authorized");
  return { admin, user };
}

export async function GET(req: NextRequest) {
  try {
    const { admin } = await auth(req);
    const { data: orders, error } = await admin
      .from("wise_menu_orders")
      .select("id,order_no,customer_name,notes,status,total,created_at,source_type,wise_menu_order_items(product_name,quantity,unit_price,line_total,product_id,options)")
      .in("status", ["new", "accepted", "preparing", "ready"])
      .order("created_at", { ascending: true });
    if (error) throw error;
    const items = orders || [];
    const productIds = [...new Set(items.flatMap((o: any) => o.wise_menu_order_items?.map((i: any) => i.product_id) || []))];
    let recipes: any[] = [];
    let products: any[] = [];
    if (productIds.length) {
      const [{ data: r }, { data: p }] = await Promise.all([
        admin.from("wise_product_recipes").select("id,product_id,recipe_name,wise_product_recipe_items(quantity,unit,inventory_item_id,inventory_items(name,unit,density_g_per_ml))").in("product_id", productIds),
        admin.from("products").select("id,requires_cup_label").in("id", productIds)
      ]);
      recipes = r || [];
      products = p || [];
    }
    const result = items.map((o: any) => ({
      ...o,
      items: (o.wise_menu_order_items || []).map((i: any) => {
        const recipe = recipes.find((r: any) => r.product_id === i.product_id);
        const product = products.find((p: any) => p.id === i.product_id);
        return {
          ...i,
          requires_cup_label: Boolean(product?.requires_cup_label),
          recipe_name: recipe?.recipe_name || null,
          ingredients: (recipe?.wise_product_recipe_items || []).map((x: any) => {
            const rawQuantity = Number(x.quantity) * Number(i.quantity);
            const rawUnit = String(x.unit || "unit").toLowerCase().replace(/[^a-z]/g, "");
            const density = Number(x.inventory_items?.density_g_per_ml || 0);
            let quantity = rawQuantity;
            let unit = x.unit || "unit";

            // Kitchen-facing display: prefer grams for weight/volume ingredients.
            // Inventory deduction/calculation still uses the recipe's original units.
            if (rawUnit === "kg" || rawUnit === "kgs" || rawUnit === "kilogram" || rawUnit === "kilograms") {
              quantity = rawQuantity * 1000;
              unit = "g";
            } else if (rawUnit === "g" || rawUnit === "gram" || rawUnit === "grams") {
              quantity = rawQuantity;
              unit = "g";
            } else if ((rawUnit === "l" || rawUnit === "liter" || rawUnit === "liters" || rawUnit === "litre" || rawUnit === "litres") && density > 0) {
              quantity = rawQuantity * 1000 * density;
              unit = "g";
            } else if ((rawUnit === "ml" || rawUnit === "milliliter" || rawUnit === "milliliters" || rawUnit === "millilitre" || rawUnit === "millilitres") && density > 0) {
              quantity = rawQuantity * density;
              unit = "g";
            } else if ((rawUnit === "oz" || rawUnit === "ounce" || rawUnit === "ounces") && density <= 0) {
              quantity = rawQuantity * 28.349523125;
              unit = "g";
            }

            // If the recipe is stored in volume but density is unavailable,
            // keep ml/L rather than showing an inaccurate gram conversion.
            return {
              name: x.inventory_items?.name || "Ingredient",
              quantity: Number(quantity.toFixed(unit === "g" ? 1 : 3)),
              unit
            };
          })
        };
      })
    }));
    return NextResponse.json({ orders: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unauthorized" }, { status: e.message === "Authentication required" ? 401 : 403 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { admin } = await auth(req);
    const body = await req.json();
    if (!body.order_id || !body.status) throw new Error("order_id and status are required");
    if (body.status === "send_to_pos") {
      const { data, error } = await admin.rpc("convert_wise_menu_order_to_pos", { p_order_id: body.order_id });
      if (error) throw error;
      return NextResponse.json(data || { ok: true });
    }
    const allowed = ["new", "accepted", "preparing", "ready", "served", "cancelled"];
    if (!allowed.includes(body.status)) throw new Error("Invalid kitchen status");
    const { data, error } = await admin.rpc("wise_process_menu_order", { p_order_id: body.order_id, p_status: body.status });
    if (error) throw error;
    return NextResponse.json(data || { ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unable to update order" }, { status: e.message === "Authentication required" ? 401 : 400 });
  }
}
