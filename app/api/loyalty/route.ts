import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const env = (...keys: string[]) => keys.map(k => process.env[k]?.trim()).find(Boolean) || "";
const url = env("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
const service = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY");

async function authorize(request: NextRequest) {
  if (!url || !anon || !service) return { error: NextResponse.json({error:"Loyalty service is not configured."},{status:503}) };
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i,"").trim();
  if (!token) return { error: NextResponse.json({error:"Please sign in again."},{status:401}) };
  const auth = createClient(url, anon, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await auth.auth.getUser(token);
  if (error || !data.user) return {error:NextResponse.json({error:"Your session has expired."},{status:401})};
  const db = createClient(url, service, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:profileError} = await db.from("profiles").select("role,is_active").eq("id",data.user.id).maybeSingle();
  const role=String(profile?.role || "").toLowerCase();
  if(profileError || !profile || profile.is_active===false || !["admin","staff","cashier","manager"].includes(role))
    return {error:NextResponse.json({error:"Active staff access is required."},{status:403})};
  return {user:data.user,db};
}

export async function GET(request: NextRequest) {
  const auth=await authorize(request); if(auth.error) return auth.error;
  const q=request.nextUrl.searchParams.get("q")?.trim() || "";
  let query=auth.db.from("loyalty_members").select("id,loyalty_no,full_name,phone,stamps,free_drinks_redeemed,is_active,created_at").order("created_at",{ascending:false}).limit(500);
  if(q) query=query.or("full_name.ilike.%"+q.replace(/[%_]/g,"")+"%,phone.ilike.%"+q.replace(/[%_]/g,"")+"%,loyalty_no.ilike.%"+q.replace(/[%_]/g,"")+"%");
  const {data,error}=await query;
  if(error) return NextResponse.json({error:"Unable to load loyalty members: "+error.message},{status:400});
  return NextResponse.json({members:data||[]});
}

export async function POST(request: NextRequest) {
  const auth=await authorize(request); if(auth.error) return auth.error;
  const body=await request.json().catch(()=>null);
  if(!body) return NextResponse.json({error:"Invalid request."},{status:400});
  const action=String(body.action||"register");
  if(action==="register") {
    const fullName=String(body.fullName||"").trim();
    const phone=String(body.phone||"").trim();
    if(!fullName || !phone) return NextResponse.json({error:"Enter the member's full name and mobile number."},{status:400});
    const digits=phone.replace(/\D/g,"");
    if(digits.length<10 || digits.length>13) return NextResponse.json({error:"Enter a valid mobile number."},{status:400});
    const {data:existing}=await auth.db.from("loyalty_members").select("id,loyalty_no,full_name,phone").eq("phone",phone).maybeSingle();
    if(existing) return NextResponse.json({error:"This exact mobile number is already registered.",member:existing},{status:409});
    const loyaltyNo="ESP-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();
    const {data,error}=await auth.db.from("loyalty_members").insert({loyalty_no:loyaltyNo,full_name:fullName,phone,created_by:auth.user.id}).select("id,loyalty_no,full_name,phone,stamps,free_drinks_redeemed,is_active,created_at").single();
    if(error) return NextResponse.json({error:"Unable to register member: "+error.message},{status:400});
    return NextResponse.json({member:data},{status:201});
  }
  if(action==="manual_stamp") {
    const memberId=String(body.memberId||"").trim();
    const orderNo=String(body.orderNo||"").trim();
    if(!memberId || !orderNo) return NextResponse.json({error:"Select a member and enter the completed POS order number."},{status:400});
    const {data:order,error:orderError}=await auth.db.from("pos_orders").select("id,order_no,status").eq("order_no",orderNo).maybeSingle();
    if(orderError) return NextResponse.json({error:"Unable to find POS order: "+orderError.message},{status:400});
    if(!order) return NextResponse.json({error:"No POS order found with that order number."},{status:404});
    if(!["completed","paid","complete"].includes(String(order.status||"").toLowerCase())) return NextResponse.json({error:"Only completed/paid POS orders can receive a loyalty stamp."},{status:400});
    const {data:stampResult,error:stampError}=await auth.db.rpc("award_loyalty_stamp",{p_order_id:order.id,p_member_id:memberId});
    if(stampError) return NextResponse.json({error:stampError.message||"Unable to award the stamp."},{status:400});
    if(stampResult?.duplicate) return NextResponse.json({error:"This POS order already has a loyalty stamp. No duplicate stamp was added."},{status:409});
    const {data:member,error:memberError}=await auth.db.from("loyalty_members").select("id,loyalty_no,full_name,phone,stamps,free_drinks_redeemed,is_active,created_at").eq("id",memberId).single();
    if(memberError||!member) return NextResponse.json({error:"Stamp was saved, but member details could not be refreshed. Please refresh the page."},{status:200});
    return NextResponse.json({member,stamped:true,orderNo:order.order_no,freeDrinkEarned:Boolean(stampResult?.free_drink_earned)});
  }
  if(action==="redeem") {
    const memberId=String(body.memberId||"");
    if(!memberId) return NextResponse.json({error:"Select a loyalty member."},{status:400});
    const {data:member,error:readError}=await auth.db.from("loyalty_members").select("id,stamps,free_drinks_redeemed").eq("id",memberId).eq("is_active",true).maybeSingle();
    if(readError || !member) return NextResponse.json({error:"Member not found."},{status:404});
    if(Number(member.stamps)<9) return NextResponse.json({error:"Member needs 9 stamps before redeeming a free drink."},{status:400});
    const {data,error}=await auth.db.from("loyalty_members").update({stamps:0,free_drinks_redeemed:Number(member.free_drinks_redeemed||0)+1}).eq("id",memberId).eq("stamps",9).select("id,loyalty_no,full_name,phone,stamps,free_drinks_redeemed,is_active,created_at").maybeSingle();
    if(error || !data) return NextResponse.json({error:"Redemption could not be saved. Refresh and try again."},{status:409});
    return NextResponse.json({member:data,redeemed:true});
  }
  return NextResponse.json({error:"Unsupported loyalty action."},{status:400});
}
