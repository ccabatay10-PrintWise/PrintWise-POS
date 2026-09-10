import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function auth(req:NextRequest){
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)throw new Error("Authentication required");
 const sb=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user},error}=await sb.auth.getUser(token); if(error||!user)throw new Error("Authentication required");
 const admin=createClient(url,service); const {data:p}=await admin.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
 if(!p?.is_active||!["admin","staff","cashier"].includes(p.role))throw new Error("Not authorized"); return {admin,user};
}

export async function GET(req:NextRequest){try{const {admin}=await auth(req);const {data:orders,error}=await admin.from("wise_menu_orders").select("id,order_no,customer_name,notes,status,total,created_at,wise_menu_order_items(product_name,quantity,unit_price,line_total,product_id)").in("status",["new","accepted","preparing","ready"]).order("created_at",{ascending:true});if(error)throw error;const items=orders||[];const productIds=[...new Set(items.flatMap((o:any)=>o.wise_menu_order_items?.map((i:any)=>i.product_id)||[]))];let recipes:any[]=[];if(productIds.length){const {data:r}=await admin.from("wise_product_recipes").select("id,product_id,wise_product_recipe_items(quantity,unit,inventory_item_id,inventory_items(name))").in("product_id",productIds);recipes=r||[]}const result=items.map((o:any)=>({...o,items:(o.wise_menu_order_items||[]).map((i:any)=>{const recipe=recipes.find((r:any)=>r.product_id===i.product_id);return {...i,ingredients:(recipe?.wise_product_recipe_items||[]).map((x:any)=>({name:x.inventory_items?.name||"Ingredient",quantity:Number(x.quantity)*Number(i.quantity),unit:x.unit||"unit"}))}})}));return NextResponse.json({orders:result});}catch(e:any){return NextResponse.json({error:e.message||"Unauthorized"},{status:e.message==="Authentication required"?401:403})}}

export async function PATCH(req:NextRequest){try{const {admin}=await auth(req);const body=await req.json();if(!body.order_id||!body.status)throw new Error("order_id and status are required");const {data,error}=await admin.rpc("wise_process_menu_order",{p_order_id:body.order_id,p_status:body.status});if(error)throw error;return NextResponse.json(data||{ok:true});}catch(e:any){return NextResponse.json({error:e.message||"Unable to update order"},{status:e.message==="Authentication required"?401:400})}}
