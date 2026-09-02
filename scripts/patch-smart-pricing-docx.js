const fs = require("fs");
const path = require("path");

const root = process.cwd();
const smartPath = path.join(root, "app", "received-files", "[id]", "smart-pricing", "page.tsx");
const receivedPath = path.join(root, "app", "received-files", "[id]", "page.tsx");
const patchPath = path.join(root, "scripts", "smart-pricing-docx-function.txt");

function replaceOptional(source, from, to) {
  if (source.includes(to)) return source;
  return source.includes(from) ? source.replace(from, to) : source;
}

let source = fs.readFileSync(smartPath, "utf8");
const replacement = fs.readFileSync(patchPath, "utf8").trimEnd() + "\n";
const start = source.indexOf("async function analyzeDocx(blob:Blob):Promise<Analysis>{");
const end = source.indexOf("function getPaperRate(", start);
if (start < 0 || end < 0) throw new Error("PrintWise: Smart Pricing DOCX analyzer markers were not found.");
source = source.slice(0, start) + replacement + source.slice(end);
source = replaceOptional(source,
  "const[job,setJob]=useState<Job|null>(null),[file,setFile]=useState<FileItem|null>(null),[pricing,setPricing]=useState<Pricing>(defaultPricing),[analysis,setAnalysis]=useState<Analysis>(emptyAnalysis),[loading,setLoading]=useState(true),[analyzing,setAnalyzing]=useState(false),[copies,setCopies]=useState(1),[error,setError]=useState(\"\"),[settingsWarning,setSettingsWarning]=useState(\"\");",
  "const[job,setJob]=useState<Job|null>(null),[file,setFile]=useState<FileItem|null>(null),[pricing,setPricing]=useState<Pricing>(defaultPricing),[analysis,setAnalysis]=useState<Analysis>(emptyAnalysis),[loading,setLoading]=useState(true),[analyzing,setAnalyzing]=useState(false),[copies,setCopies]=useState(1),[sides,setSides]=useState(\"Single-sided\"),[error,setError]=useState(\"\"),[settingsWarning,setSettingsWarning]=useState(\"\");");
source = replaceOptional(source,"function computePrice(a:Analysis,p:Pricing,copies:number):Computation{","function computePrice(a:Analysis,p:Pricing,copies:number,sides:string=\"Single-sided\"):Computation{");
source = replaceOptional(source,"const multiplier=Math.max(1,n(copies));const material=getPaperRate(a.paper,p)*a.pages*multiplier;const ink=","const multiplier=Math.max(1,n(copies));const physicalSheets=sides===\"Double-sided\"?Math.ceil(a.pages/2):a.pages;const material=getPaperRate(a.paper,p)*physicalSheets*multiplier;const ink=");
source = replaceOptional(source,"const machine=a.pages*n(p.machine_cost_per_page)*multiplier,labor=n(p.labor_cost_per_job),","const machine=physicalSheets*n(p.machine_cost_per_page)*multiplier,labor=n(p.labor_cost_per_job),");
source = replaceOptional(source,"const computation=useMemo(()=>computePrice(analysis,pricing,copies),[analysis,pricing,copies]);","const computation=useMemo(()=>computePrice(analysis,pricing,copies,sides),[analysis,pricing,copies,sides]);");
source = replaceOptional(source,"JSON.stringify({fileId:file.id,jobId:job?.id,analysis,copies,pricing,computation,usedAt:new Date().toISOString()})","JSON.stringify({fileId:file.id,jobId:job?.id,analysis,copies,sides,pricing,computation,usedAt:new Date().toISOString()})");
source = replaceOptional(source,"<label className=\"copies-field\">Copies / Quantity<input type=\"number\" min=\"1\" value={copies} onChange={e=>setCopies(Math.max(1,Number(e.target.value)||1))}/></label>","<div className=\"smart-print-options\"><label className=\"copies-field\">Print Sides<select value={sides} onChange={e=>setSides(e.target.value)}><option value=\"Single-sided\">Single-sided</option><option value=\"Double-sided\">Back-to-Back (Duplex)</option></select></label><label className=\"copies-field\">Copies / Quantity<input type=\"number\" min=\"1\" value={copies} onChange={e=>setCopies(Math.max(1,Number(e.target.value)||1))}/></label></div>");
source = replaceOptional(source,".copies-field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:#5e6872;margin-bottom:14px}",".smart-print-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}.copies-field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:#5e6872;margin-bottom:14px}.copies-field select,.copies-field input{padding:13px;border:1px solid #dce2e7;border-radius:12px;font-size:17px;background:#fff}");
source = replaceOptional(source,"@media(max-width:640px){.smart-main{padding:16px}","@media(max-width:640px){.smart-main{padding:16px}.smart-print-options{grid-template-columns:1fr}");
fs.writeFileSync(smartPath, source, "utf8");

let received = fs.readFileSync(receivedPath, "utf8");
received = replaceOptional(received,
  "return {mode:\"PRINT\",paperSize:paper,colorMode:colorTotal>0?\"Colored\":\"Black & White\",inkCoverage:coverage||\"Normal\",pages:Math.max(1,Number(a.pages)||1),copies:Math.max(1,Number(transfer.copies)||1),smartPrice:Number(suggested.toFixed(2)),smartApplied:true,smartComputation:transfer.computation||undefined};",
  "return {mode:\"PRINT\",paperSize:paper,colorMode:colorTotal>0?\"Colored\":\"Black & White\",inkCoverage:coverage||\"Normal\",sides:transfer.sides===\"Double-sided\"?\"Double-sided\":\"Single-sided\",pages:Math.max(1,Number(a.pages)||1),copies:Math.max(1,Number(transfer.copies)||1),smartPrice:Number(suggested.toFixed(2)),smartApplied:true,smartComputation:transfer.computation||undefined};");
received = replaceOptional(received,"const duplex=Math.max(pageFloor,production+markup);\n   return Number(Math.min(Number(s.smartPrice),duplex).toFixed(2));","const duplex=Math.max(pageFloor,production+markup);\n   if(duplex<=0)return Number(s.smartPrice);\n   return Number(Math.min(Number(s.smartPrice),duplex).toFixed(2));");
received = replaceOptional(received,"<option>Single-sided</option><option>Double-sided</option>","<option value=\"Single-sided\">Single-sided</option><option value=\"Double-sided\">Back-to-Back (Duplex)</option>");

const oldHero = "  <section className=\"job-hero\"><div><span className=\"eyebrow\">INCOMING FILE JOB</span><h1>{job.reference_no}</h1><p>Received {date}</p></div><span className={`status ${job.status.toLowerCase()}`}>{job.status.replaceAll(\"_\",\" \")}</span></section>";
const newHero = "  <section className=\"job-hero incoming-file-job\"><div className=\"incoming-job-main\"><div className=\"incoming-job-heading\"><div><span className=\"eyebrow\">INCOMING FILE JOB</span><h1>{job.reference_no}</h1><p>Received {date}</p></div><span className={`status ${job.status.toLowerCase()}`}>{job.status.replaceAll(\"_\",\" \")}</span></div><div className=\"incoming-file-list\">{files.map((file,index)=>{const s=setups[file.id]??defaultSetup();const est=estimateFile(s);return <article className=\"incoming-file-item\" key={file.id}><div className=\"incoming-file-info\"><span className=\"file-number\">{index+1}</span><span className=\"file-icon\"><FileText size={20}/></span><div><b>{file.original_name}</b><small>{file.mime_type||\"Unknown file type\"} · {formatBytes(Number(file.size_bytes||0))}</small></div></div><div className=\"incoming-file-actions\"><button onClick={()=>openFile(file)}><ExternalLink size={16}/> Open</button><button onClick={()=>openFile(file,true)}><Download size={16}/> Download</button><button className=\"smart-pricing-btn\" onClick={()=>goToSmartPricing(file)}><Sparkles size={16}/> Smart Pricing</button>{s.smartApplied&&<div className=\"incoming-smart-price\"><small>Smart Price</small><b>{money(est)}</b><span>{Math.max(1,s.pages)} page × {Math.max(1,s.copies)} copy</span></div>}</div></article>})}</div></div></section>";
received = replaceOptional(received, oldHero, newHero);

const filesStart = received.indexOf("  <section className=\"job-card files-card\">");
const mainEnd = filesStart >= 0 ? received.indexOf("  </main>", filesStart) : -1;
if (filesStart >= 0 && mainEnd >= 0) received = received.slice(0, filesStart) + received.slice(mainEnd);

// Add styling for the consolidated Incoming File Job area without touching the existing global styles.
const incomingStyles = `<style jsx global>{`.replace("<style jsx global>{","");
const css = `.incoming-file-job{padding:24px}.incoming-job-main{width:100%}.incoming-job-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.incoming-file-list{margin-top:22px;border-top:1px solid #e6eaee}.incoming-file-item{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 0;border-bottom:1px solid #e6eaee}.incoming-file-info{display:flex;align-items:center;gap:12px;min-width:0}.incoming-file-info>div{min-width:0}.incoming-file-info b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.incoming-file-info small{display:block;color:#7b858e;margin-top:4px}.incoming-file-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.incoming-file-actions button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 14px;border:1px solid #dce2e7;border-radius:10px;background:#fff;font-weight:800;font-size:13px;cursor:pointer}.incoming-file-actions .smart-pricing-btn{background:#f00;color:#fff;border-color:#f00}.incoming-smart-price{display:flex;flex-direction:column;min-width:118px;padding:9px 12px;border:1px solid #ffc9c9;border-radius:10px;background:#fff7f7}.incoming-smart-price small{font-size:11px;color:#777}.incoming-smart-price b{font-size:18px;color:#f00}.incoming-smart-price span{font-size:10px;color:#777;margin-top:2px}@media(max-width:760px){.incoming-file-item{align-items:flex-start;flex-direction:column}.incoming-file-actions{width:100%;justify-content:flex-start}.incoming-file-actions button{flex:1}.incoming-smart-price{min-width:0}.incoming-job-heading{flex-direction:column}}`;
received = received.replace(/(const styles=`[\\s\\S]*?)(`;)/, `$1${css}$2`);

fs.writeFileSync(receivedPath, received, "utf8");
console.log("PrintWise: consolidated Incoming File Job actions and Smart Pricing patched.");
