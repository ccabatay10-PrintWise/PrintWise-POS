"use client";
import {useEffect,useState} from "react";
import {Clock3,LogIn,LogOut,ShieldCheck,CheckCircle2,AlertCircle,Settings2,ArrowLeft} from "lucide-react";
import {supabase} from "../../lib/supabase";

const green="#147b61";
const fieldStyle={width:"100%",height:48,border:"1px solid #dce7e1",borderRadius:10,padding:"0 12px",fontSize:14,color:"#25473c",background:"#fbfdfc",boxSizing:"border-box" as const};
const primaryStyle={height:48,border:0,borderRadius:10,background:green,color:"#fff",fontWeight:800,cursor:"pointer",width:"100%"};
export default function AttendanceKiosk(){
 const [pin,setPin]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null);
 const [setupOpen,setSetupOpen]=useState(false);
 const [employees,setEmployees]=useState<Array<{id:string;full_name:string;employee_code:string|null}>>([]);
 const [employeeId,setEmployeeId]=useState("");
 const [newPin,setNewPin]=useState("");
 const [confirmPin,setConfirmPin]=useState("");
 useEffect(()=>{
  const handleKeyDown=(event:KeyboardEvent)=>{
   if(setupOpen||busy)return;
   const target=event.target as HTMLElement|null;
   if(target&&(target.tagName==="INPUT"||target.tagName==="TEXTAREA"||target.tagName==="SELECT"||target.isContentEditable))return;
   if(/^[0-9]$/.test(event.key)){event.preventDefault();setPin(current=>(current+event.key).slice(0,4));}
   else if(event.key==="Backspace"){event.preventDefault();setPin(current=>current.slice(0,-1));}
   else if(event.key==="Escape"){event.preventDefault();setPin("");}
  };
  window.addEventListener("keydown",handleKeyDown);
  return ()=>window.removeEventListener("keydown",handleKeyDown);
 },[setupOpen,busy]);
 const submit=async(action:"time_in"|"time_out")=>{
  if(pin.length!==4){setNotice({ok:false,text:"Please enter your 4-digit employee PIN."});return}
  setBusy(true);setNotice(null);
  const {data,error}=await supabase.rpc("record_payroll_attendance_pin",{p_pin:pin,p_action:action});
  if(error)setNotice({ok:false,text:error.message});
  else setNotice({ok:true,text:data?.employee+" — "+(action==="time_in"?"TIME IN":"TIME OUT")+" successfully recorded. Date: "+data?.date+" · Time: "+data?.time+"."});
  setPin("");setBusy(false);
 };
 const openSetup=async()=>{
  setNotice(null);setBusy(true);
  const {data,error}=await supabase.from("payroll_employees").select("id,full_name,employee_code").eq("is_active",true).order("full_name");
  if(error)setNotice({ok:false,text:"Unable to load employees. Please sign in as an administrator."});
  else{setEmployees((data||[]) as any);setSetupOpen(true)}
  setBusy(false);
 };
 const savePin=async()=>{
  if(!employeeId){setNotice({ok:false,text:"Select your employee record."});return}
  if(!/^\\d{4}$/.test(newPin)){setNotice({ok:false,text:"PIN must contain exactly 4 digits."});return}
  if(newPin!==confirmPin){setNotice({ok:false,text:"PIN confirmation does not match."});return}
  setBusy(true);
  const {error}=await supabase.rpc("set_payroll_employee_pin",{p_employee_id:employeeId,p_pin:newPin});
  if(error)setNotice({ok:false,text:error.message});
  else{setNotice({ok:true,text:"Attendance PIN successfully set. You can now use it to time in and time out."});setSetupOpen(false);setEmployeeId("");setNewPin("");setConfirmPin("")}
  setBusy(false);
 };
 const key=(v:string)=>setPin(old=>(old+v).slice(0,4));
 const card={width:"min(100%,420px)",background:"#fff",border:"1px solid #e1ebe6",borderRadius:24,padding:30,boxShadow:"0 20px 60px #1c44301a",textAlign:"center" as const,color:"#173c32",fontFamily:"Arial,sans-serif"};
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at top,#e7f4ef,#f5f7f6 55%,#e9efec)"}}>
  <div style={card}>
   <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:28,textAlign:"left"}}>
    <span style={{width:48,height:48,display:"grid",placeItems:"center",borderRadius:14,background:"#e8f5ef",color:green}}><Clock3 size={26}/></span>
    <div><b style={{display:"block",fontSize:17,letterSpacing:2}}>ESPACIO</b><small style={{display:"block",marginTop:4,fontSize:9,letterSpacing:1.4,color:"#7a9087"}}>EMPLOYEE ATTENDANCE</small></div>
   </div>
   {setupOpen?<div>
    <h1 style={{fontSize:24,margin:"0 0 8px"}}>Set Up Employee PIN</h1>
    <p style={{fontSize:13,color:"#71857d",margin:"0 0 22px"}}>Select your employee record and create a private 4-digit PIN. Administrator access is required.</p>
    <div style={{display:"flex",flexDirection:"column",gap:11,maxWidth:290,margin:"22px auto"}}>
     <select style={fieldStyle} value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name}{e.employee_code?" · "+e.employee_code:""}</option>)}</select>
     <input style={fieldStyle} aria-label="New 4-digit PIN" type="password" inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\\D/g,"").slice(0,4))}/>
     <input style={fieldStyle} aria-label="Confirm 4-digit PIN" type="password" inputMode="numeric" maxLength={4} placeholder="Confirm 4-digit PIN" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\\D/g,"").slice(0,4))}/>
     <button style={primaryStyle} disabled={busy} onClick={()=>void savePin()}>SAVE PIN</button>
     <button style={{...primaryStyle,background:"#edf4f0",color:"#31584a",display:"flex",alignItems:"center",justifyContent:"center",gap:7}} disabled={busy} onClick={()=>setSetupOpen(false)}><ArrowLeft size={15}/> BACK TO ATTENDANCE</button>
    </div>
   </div>:<div>
    <h1 style={{fontSize:24,margin:"0 0 8px"}}>Daily Time Record</h1>
    <p style={{fontSize:13,color:"#71857d",margin:"0 0 22px"}}>Enter your personal 4-digit PIN to record attendance.</p>
    <div style={{display:"flex",justifyContent:"center",gap:14,margin:"0 auto 22px"}}>{[0,1,2,3].map(i=><span key={i} style={{width:48,height:52,border:"1px solid #dce7e1",borderRadius:12,display:"grid",placeItems:"center",fontSize:30,color:green,background:pin.length>i?"#f0faf5":"#fbfdfc"}}>{pin.length>i?"•":""}</span>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,maxWidth:290,margin:"0 auto 18px"}}>{["1","2","3","4","5","6","7","8","9","clear","0","back"].map(v=><button key={v} type="button" style={{height:52,border:"1px solid #e3ebe6",borderRadius:12,background:"#fbfdfc",color:"#25473c",fontSize:v==="clear"||v==="back"?11:19,fontWeight:700,cursor:"pointer"}} onClick={()=>v==="clear"?setPin(""):v==="back"?setPin(x=>x.slice(0,-1)):key(v)}>{v==="clear"?"CLEAR":v==="back"?"⌫":v}</button>)}</div>
    {notice&&<div style={{display:"flex",alignItems:"center",gap:9,padding:12,borderRadius:11,textAlign:"left",fontSize:12,lineHeight:1.4,margin:"0 0 16px",background:notice.ok?"#eaf8f0":"#fff1f0",color:notice.ok?"#14633f":"#a32f2a"}}>{notice.ok?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}<span>{notice.text}</span></div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
     <button style={{...primaryStyle,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:busy||pin.length!==4?.4:1}} disabled={busy||pin.length!==4} onClick={()=>void submit("time_in")}><LogIn size={19}/> TIME IN</button>
     <button style={{...primaryStyle,background:"#263f36",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:busy||pin.length!==4?.4:1}} disabled={busy||pin.length!==4} onClick={()=>void submit("time_out")}><LogOut size={19}/> TIME OUT</button>
    </div>
    <button style={{marginTop:14,border:0,background:"transparent",color:green,fontSize:11,fontWeight:800,letterSpacing:.4,display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}} disabled={busy} onClick={()=>void openSetup()}><Settings2 size={14}/> SET UP PIN</button>
    <button style={{marginTop:8,border:0,background:"transparent",color:"#526b60",fontSize:11,fontWeight:800,letterSpacing:.4,display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>window.location.assign("/pos")}><ArrowLeft size={14}/> BACK TO POS</button>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:22,color:"#8a9b93",fontSize:10}}><ShieldCheck size={14}/> Attendance is automatically saved to WISE POS Payroll.</div>
   </div>}
  </div>
 </main>
}
