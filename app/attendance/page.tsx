"use client";
import {useState} from "react";
import {Clock3,LogIn,LogOut,ShieldCheck,CheckCircle2,AlertCircle,Settings2,ArrowLeft} from "lucide-react";
import {supabase} from "../../lib/supabase";

export default function AttendanceKiosk(){
 const [pin,setPin]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null);\n const [setupOpen,setSetupOpen]=useState(false);\n const [employees,setEmployees]=useState<Array<{id:string;full_name:string;employee_code:string|null}>>([]);\n const [employeeId,setEmployeeId]=useState("");\n const [newPin,setNewPin]=useState("");\n const [confirmPin,setConfirmPin]=useState("");
 const submit=async(action:"time_in"|"time_out")=>{
  if(pin.length!==4){setNotice({ok:false,text:"Please enter your 4-digit employee PIN."});return}
  setBusy(true);setNotice(null);
  const {data,error}=await supabase.rpc("record_payroll_attendance_pin",{p_pin:pin,p_action:action});
  if(error)setNotice({ok:false,text:error.message.replace(/^.*ERROR:\\s*/,"")});
  else setNotice({ok:true,text:`${data.employee} — ${action==="time_in"?"TIME IN":"TIME OUT"} recorded at ${data.time}.`});
  setPin("");setBusy(false);
 };
 const openSetup=async()=>{setNotice(null);setBusy(true);const {data,error}=await supabase.from("payroll_employees").select("id,full_name,employee_code").eq("is_active",true).order("full_name");if(error){setNotice({ok:false,text:"Unable to load employees. Please sign in as an administrator."});}else{setEmployees((data||[]) as any);setSetupOpen(true);}setBusy(false);};
 const savePin=async()=>{if(!employeeId){setNotice({ok:false,text:"Select your employee record."});return}if(!/^\\d{4}$/.test(newPin)){setNotice({ok:false,text:"PIN must contain exactly 4 digits."});return}if(newPin!==confirmPin){setNotice({ok:false,text:"PIN confirmation does not match."});return}setBusy(true);const {error}=await supabase.rpc("set_payroll_employee_pin",{p_employee_id:employeeId,p_pin:newPin});if(error)setNotice({ok:false,text:error.message});else{setNotice({ok:true,text:"Attendance PIN successfully set. You can now use it to time in and time out."});setSetupOpen(false);setEmployeeId("");setNewPin("");setConfirmPin("");}setBusy(false);};
 const key=(v:string)=>setPin(old=>(old+v).slice(0,4));
 return <main className="att-kiosk"><div className="att-card">
  <div className="att-brand"><span><Clock3 size={26}/></span><div><b>ESPACIO</b><small>EMPLOYEE ATTENDANCE</small></div></div>
  {setupOpen?<><h1>Set Up Employee PIN</h1><p className="att-sub">Select your employee record and create a private 4-digit PIN. Administrator access is required.</p><div className="att-setup-form"><select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name}{e.employee_code? ` · ${e.employee_code}`:""}</option>)}</select><input aria-label="New 4-digit PIN" type="password" inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\\D/g,"").slice(0,4))}/><input aria-label="Confirm 4-digit PIN" type="password" inputMode="numeric" maxLength={4} placeholder="Confirm 4-digit PIN" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\\D/g,"").slice(0,4))}/><button disabled={busy} onClick={()=>void savePin()}>SAVE PIN</button><button className="att-back" disabled={busy} onClick={()=>setSetupOpen(false)}><ArrowLeft size={15}/> BACK TO ATTENDANCE</button></div></>:<><h1>Daily Time Record</h1><p className="att-sub">Enter your personal 4-digit PIN to record attendance.</p>
  <div className="att-pin" aria-label="PIN entry">{[0,1,2,3].map(i=><span key={i} className={pin.length>i?"filled":""}>{pin.length>i?"•":""}</span>)}</div>
  <div className="att-pad">{["1","2","3","4","5","6","7","8","9","clear","0","back"].map(v=><button key={v} type="button" className={v==="clear"||v==="back"?"utility":""} onClick={()=>v==="clear"?setPin(""):v==="back"?setPin(x=>x.slice(0,-1)):key(v)}>{v==="clear"?"CLEAR":v==="back"?"⌫":v}</button>)}</div>
  {notice&&<div className={`att-notice ${notice.ok?"ok":"error"}`}>{notice.ok?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}<span>{notice.text}</span></div>}
  <div className="att-actions"><button disabled={busy||pin.length!==4} onClick={()=>void submit("time_in")}><LogIn size={19}/> TIME IN</button><button disabled={busy||pin.length!==4} onClick={()=>void submit("time_out")}><LogOut size={19}/> TIME OUT</button></div><button className="att-setup-link" disabled={busy} onClick={()=>void openSetup()}><Settings2 size={14}/> SET UP PIN</button>
  <div className="att-foot"><ShieldCheck size={14}/> Attendance is automatically saved to WISE POS Payroll.</div></> 
 </div><style jsx>{`
 .att-kiosk{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#e7f4ef,#f5f7f6 55%,#e9efec);font-family:Arial,sans-serif;color:#173c32}
 .att-card{width:min(100%,420px);background:#fff;border:1px solid #e1ebe6;border-radius:24px;padding:30px;box-shadow:0 20px 60px #1c44301a;text-align:center}
 .att-brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:28px;text-align:left}.att-brand>span{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#e8f5ef;color:#168064}.att-brand b{display:block;font-size:17px;letter-spacing:2px}.att-brand small{display:block;margin-top:4px;font-size:9px;letter-spacing:1.4px;color:#7a9087}
 h1{font-size:24px;margin:0 0 8px}.att-sub{font-size:13px;color:#71857d;margin:0 0 22px}
 .att-pin{display:flex;justify-content:center;gap:14px;margin:0 auto 22px}.att-pin span{width:48px;height:52px;border:1px solid #dce7e1;border-radius:12px;display:grid;place-items:center;font-size:30px;color:#147b61;background:#fbfdfc}.att-pin span.filled{border-color:#168064;background:#f0faf5}
 .att-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;max-width:290px;margin:0 auto 18px}.att-pad button{height:52px;border:1px solid #e3ebe6;border-radius:12px;background:#fbfdfc;color:#25473c;font-size:19px;font-weight:700;cursor:pointer}.att-pad button:hover{background:#eaf6f0;border-color:#b8d8c8}.att-pad button.utility{font-size:11px;color:#6f8179}
 .att-notice{display:flex;align-items:center;gap:9px;padding:12px;border-radius:11px;text-align:left;font-size:12px;line-height:1.4;margin:0 0 16px}.att-notice.ok{background:#eaf8f0;color:#14633f}.att-notice.error{background:#fff1f0;color:#a32f2a}
 .att-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.att-actions button{height:52px;border:0;border-radius:12px;background:#147b61;color:white;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.att-actions button+button{background:#263f36}.att-actions button:disabled{opacity:.4;cursor:not-allowed}
 .att-setup-link{margin-top:14px;border:0;background:transparent;color:#168064;font-size:11px;font-weight:800;letter-spacing:.4px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.att-setup-link:hover{text-decoration:underline}
 .att-setup-form{display:flex;flex-direction:column;gap:11px;margin:22px auto;max-width:290px}.att-setup-form select,.att-setup-form input{height:46px;border:1px solid #dce7e1;border-radius:10px;padding:0 12px;font-size:13px;color:#25473c;background:#fbfdfc}.att-setup-form button{height:46px;border:0;border-radius:10px;background:#147b61;color:white;font-weight:800;cursor:pointer}.att-setup-form button:disabled{opacity:.5}.att-setup-form button.att-back{background:#edf4f0;color:#31584a;display:flex;align-items:center;justify-content:center;gap:7px}
 .att-foot{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:22px;color:#8a9b93;font-size:10px}
 @media(max-width:420px){.att-card{padding:22px 17px}.att-pin{gap:9px}.att-pin span{width:44px}}
 `}</style></main>
}
