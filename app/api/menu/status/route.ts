import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY!;
export async function GET(req:NextRequest){
 const order=String(req.nextUrl.searchParams.get("order")||"").trim();
 if(!order||order.length>40)return NextResponse.json({error:"Order not found"},{status:400});
 const sb=createClient(url,service);
 const {data,error}=await sb.from("wise_menu_orders").select("order_no,customer_name,status,created_at,updated_at").eq("order_no",order).maybeSingle();
 if(error)return NextResponse.json({error:"Unable to check order status"},{status:500});
 if(!data)return NextResponse.json({error:"Order not found"},{status:404});
 return NextResponse.json({order:data},{headers:{"Cache-Control":"no-store"}});
}
