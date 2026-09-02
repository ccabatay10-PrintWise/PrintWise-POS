const fs = require("fs");
const path = require("path");

const root = process.cwd();
const smartPath = path.join(root, "app", "received-files", "[id]", "smart-pricing", "page.tsx");
const receivedPath = path.join(root, "app", "received-files", "[id]", "page.tsx");
const patchPath = path.join(root, "scripts", "smart-pricing-docx-function.txt");

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    if (source.includes(to)) return source;
    throw new Error(`PrintWise: ${label} marker was not found; refusing to patch the working page.`);
  }
  return source.replace(from, to);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  if (pattern.test(source)) return source.replace(pattern, replacement);
  if (typeof replacement === "string" && source.includes(replacement)) return source;
  throw new Error(`PrintWise: ${label} marker was not found; refusing to patch the working page.`);
}

let source = fs.readFileSync(smartPath, "utf8");
const replacement = fs.readFileSync(patchPath, "utf8").trimEnd() + "\n";
const start = source.indexOf("async function analyzeDocx(blob:Blob):Promise<Analysis>{");
const end = source.indexOf("function getPaperRate(", start);
if (start < 0 || end < 0) {
  throw new Error("Smart Pricing analyzeDocx markers were not found; refusing to patch the working page.");
}
source = source.slice(0, start) + replacement + source.slice(end);

source = replaceOnce(
  source,
  "const[job,setJob]=useState<Job|null>(null),[file,setFile]=useState<FileItem|null>(null),[pricing,setPricing]=useState<Pricing>(defaultPricing),[analysis,setAnalysis]=useState<Analysis>(emptyAnalysis),[loading,setLoading]=useState(true),[analyzing,setAnalyzing]=useState(false),[copies,setCopies]=useState(1),[error,setError]=useState(\"\"),[settingsWarning,setSettingsWarning]=useState(\"\");",
  "const[job,setJob]=useState<Job|null>(null),[file,setFile]=useState<FileItem|null>(null),[pricing,setPricing]=useState<Pricing>(defaultPricing),[analysis,setAnalysis]=useState<Analysis>(emptyAnalysis),[loading,setLoading]=useState(true),[analyzing,setAnalyzing]=useState(false),[copies,setCopies]=useState(1),[sides,setSides]=useState(\"Single-sided\"),[error,setError]=useState(\"\"),[settingsWarning,setSettingsWarning]=useState(\"\");",
  "Smart Pricing state"
);
source = replaceOnce(source,"function computePrice(a:Analysis,p:Pricing,copies:number):Computation{","function computePrice(a:Analysis,p:Pricing,copies:number,sides:string=\"Single-sided\"):Computation{","Smart Pricing computePrice signature");
source = replaceOnce(source,"const multiplier=Math.max(1,n(copies));const material=getPaperRate(a.paper,p)*a.pages*multiplier;const ink=","const multiplier=Math.max(1,n(copies));const physicalSheets=sides===\"Double-sided\"?Math.ceil(a.pages/2):a.pages;const material=getPaperRate(a.paper,p)*physicalSheets*multiplier;const ink=","Smart Pricing physical-sheet calculation");
source = replaceOnce(source,"const machine=a.pages*n(p.machine_cost_per_page)*multiplier,labor=n(p.labor_cost_per_job),","const machine=physicalSheets*n(p.machine_cost_per_page)*multiplier,labor=n(p.labor_cost_per_job),","Smart Pricing machine cost calculation");
source = replaceRegexOnce(source,/const pageFloor=\(\([^;]+?\)\*multiplier;/,"const pageFloor=(physicalSheets/a.pages)*((a.bwLight+a.bwMedium+a.bwHeavy)*n(p.minimum_bw_page_price)+a.colorLight*n(p.minimum_color_light_page_price)+a.colorMedium*n(p.minimum_color_medium_page_price)+a.colorHeavy*n(p.minimum_color_heavy_page_price))*multiplier;","Smart Pricing page floor calculation");
source = replaceOnce(source,"const computation=useMemo(()=>computePrice(analysis,pricing,copies),[analysis,pricing,copies]);","const computation=useMemo(()=>computePrice(analysis,pricing,copies,sides),[analysis,pricing,copies,sides]);","Smart Pricing computation state");
source = replaceOnce(source,"JSON.stringify({fileId:file.id,jobId:job?.id,analysis,copies,pricing,computation,usedAt:new Date().toISOString()})","JSON.stringify({fileId:file.id,jobId:job?.id,analysis,copies,sides,pricing,computation,usedAt:new Date().toISOString()})","Smart Pricing transfer");
source = replaceOnce(source,"<label className=\"copies-field\">Copies / Quantity<input type=\"number\" min=\"1\" value={copies} onChange={e=>setCopies(Math.max(1,Number(e.target.value)||1))}/></label>","<div className=\"smart-print-options\"><label className=\"copies-field\">Print Sides<select value={sides} onChange={e=>setSides(e.target.value)}><option value=\"Single-sided\">Single-sided</option><option value=\"Double-sided\">Back-to-Back (Duplex)</option></select></label><label className=\"copies-field\">Copies / Quantity<input type=\"number\" min=\"1\" value={copies} onChange={e=>setCopies(Math.max(1,Number(e.target.value)||1))}/></label></div>","Smart Pricing Print Sides control");
source = replaceOnce(source,".copies-field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:#5e6872;margin-bottom:14px}",".smart-print-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}.copies-field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:#5e6872;margin-bottom:14px}.copies-field select,.copies-field input{padding:13px;border:1px solid #dce2e7;border-radius:12px;font-size:17px;background:#fff}","Smart Pricing Print Sides styles");
source = replaceOnce(source,"@media(max-width:640px){.smart-main{padding:16px}","@media(max-width:640px){.smart-main{padding:16px}.smart-print-options{grid-template-columns:1fr}","Smart Pricing responsive styles");
fs.writeFileSync(smartPath, source, "utf8");

let received = fs.readFileSync(receivedPath, "utf8");
received = replaceOnce(received,"return {mode:\"PRINT\",paperSize:paper,colorMode:colorTotal>0?\"Colored\":\"Black & White\",inkCoverage:coverage||\"Normal\",pages:Math.max(1,Number(a.pages)||1),copies:Math.max(1,Number(transfer.copies)||1),smartPrice:Number(suggested.toFixed(2)),smartApplied:true,smartComputation:transfer.computation||undefined};","return {mode:\"PRINT\",paperSize:paper,colorMode:colorTotal>0?\"Colored\":\"Black & White\",inkCoverage:coverage||\"Normal\",sides:transfer.sides===\"Double-sided\"?\"Double-sided\":\"Single-sided\",pages:Math.max(1,Number(a.pages)||1),copies:Math.max(1,Number(transfer.copies)||1),smartPrice:Number(suggested.toFixed(2)),smartApplied:true,smartComputation:transfer.computation||undefined};","Received Files Smart Pricing transfer sides");
received = replaceOnce(received,"const duplex=Math.max(pageFloor,production+markup);\n   return Number(Math.min(Number(s.smartPrice),duplex).toFixed(2));","const duplex=Math.max(pageFloor,production+markup);\n   if(duplex<=0)return Number(s.smartPrice);\n   return Number(Math.min(Number(s.smartPrice),duplex).toFixed(2));","Received Files duplex zero-price fallback");
received = replaceOnce(received,"<option>Single-sided</option><option>Double-sided</option>","<option value=\"Single-sided\">Single-sided</option><option value=\"Double-sided\">Back-to-Back (Duplex)</option>","Received Files Print Sides label");
fs.writeFileSync(receivedPath, received, "utf8");
console.log("PrintWise: Smart Pricing Back-to-Back pricing patched safely.");
