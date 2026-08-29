"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import JSZip from "jszip";
import { ArrowLeft, FileText, LoaderCircle, Sparkles, CheckCircle2, Settings2 } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import { supabase } from "../../../../lib/supabase";
import "../../../pos/pos.css";

type FileItem = { id: string; original_name: string; storage_path: string; mime_type: string; size_bytes: number };
type Job = { id: string; reference_no: string; customer_name: string; email: string | null };
type Analysis = { pages:number; paper:string; bwLight:number; bwMedium:number; bwHeavy:number; colorLight:number; colorMedium:number; colorHeavy:number; method:string };
type Pricing = { business_id:string; paper_a4_cost:number; paper_legal_cost:number; paper_letter_cost:number; paper_photo_cost:number; paper_sticker_cost:number; bw_light_rate:number; bw_medium_rate:number; bw_heavy_rate:number; color_light_rate:number; color_medium_rate:number; color_heavy_rate:number; machine_cost_per_page:number; labor_cost_per_job:number; waste_allowance_percent:number; markup_percent:number; minimum_job_price:number; round_to:number };

type Computation = { material:number; ink:number; machine:number; labor:number; waste:number; production:number; markup:number; suggested:number };

const emptyAnalysis: Analysis = { pages: 0, paper: "Not analyzed", bwLight: 0, bwMedium: 0, bwHeavy: 0, colorLight: 0, colorMedium: 0, colorHeavy: 0, method: "Click Analyze File to inspect this document." };
const defaultPricing: Pricing = { business_id:"default", paper_a4_cost:0, paper_legal_cost:0, paper_letter_cost:0, paper_photo_cost:0, paper_sticker_cost:0, bw_light_rate:0, bw_medium_rate:0, bw_heavy_rate:0, color_light_rate:0, color_medium_rate:0, color_heavy_rate:0, machine_cost_per_page:0, labor_cost_per_job:0, waste_allowance_percent:0, markup_percent:0, minimum_job_price:0, round_to:0 };
const money = (n:number) => `₱${Number(n || 0).toFixed(2)}`;

const paperFromPoints = (w:number, h:number) => {
  const a = Math.min(w,h), b = Math.max(w,h);
  const near = (x:number,y:number,tx:number,ty:number) => Math.abs(x-tx) < 12 && Math.abs(y-ty) < 12;
  if (near(a,b,595,842)) return "A4";
  if (near(a,b,612,792)) return "Letter";
  if (near(a,b,612,1008)) return "Legal";
  return `${Math.round(w)} × ${Math.round(h)} pt`;
};

const paperFromTwips = (w:number,h:number) => {
  const a=Math.min(w,h), b=Math.max(w,h);
  if (Math.abs(a-11906)<80 && Math.abs(b-16838)<80) return "A4";
  if (Math.abs(a-12240)<80 && Math.abs(b-15840)<80) return "Letter";
  if (Math.abs(a-12240)<80 && Math.abs(b-20160)<80) return "Legal";
  return `${Math.round(w/1440*25.4)} × ${Math.round(h/1440*25.4)} mm`;
};

const bucket = (isColor:boolean, density:number, pages:number, paper:string, method:string):Analysis => {
  const result:Analysis = { ...emptyAnalysis, pages:Math.max(1,pages), paper, method };
  const level = density < .12 ? "Light" : density < .35 ? "Medium" : "Heavy";
  const key = `${isColor ? "color" : "bw"}${level}` as keyof Analysis;
  (result as any)[key] = result.pages;
  return result;
};

async function analyzeImage(blob:Blob):Promise<Analysis>{
  const url=URL.createObjectURL(blob);
  try {
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url});
    const max=320; const scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext("2d",{willReadFrequently:true}); if(!ctx) throw new Error("Image analysis is unavailable in this browser.");
    ctx.drawImage(image,0,0,canvas.width,canvas.height); const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let ink=0,color=0,total=0;
    for(let i=0;i<data.length;i+=16){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3]; if(a<20) continue; total++; if(Math.min(r,g,b)<235){ink++; if(Math.max(r,g,b)-Math.min(r,g,b)>22) color++;}}
    const density=total?ink/total:0; const isColor=color>Math.max(8,total*.012);
    const ratio=image.naturalWidth/image.naturalHeight;
    const paper=Math.abs(ratio-.707)<.06?"A4 / Portrait-like":"Detected image size";
    return bucket(isColor,density,1,paper,"Pixel sampling analyzed non-white coverage and color variance.");
  } finally { URL.revokeObjectURL(url); }
}

async function analyzePdf(blob:Blob):Promise<Analysis>{
  const text=new TextDecoder("latin1").decode(await blob.arrayBuffer());
  const pageMatches=text.match(/\/Type\s*\/Page(?!s)\b/g) || [];
  const pages=Math.max(1,pageMatches.length);
  const media=text.match(/\/MediaBox\s*\[\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/);
  const paper=media?paperFromPoints(Number(media[1]),Number(media[2])):"Not detected";
  const colorSignals=(text.match(/\b(?:DeviceRGB|DeviceCMYK|RG|rg|SCN|scn)\b/g)||[]).length;
  const inkSignals=(text.match(/\b(?:TJ|Tj|Do|re|f|F|S|s)\b/g)||[]).length;
  const density=Math.min(.75,inkSignals/Math.max(120,pages*260));
  return bucket(colorSignals>2,density,pages,paper,"PDF structure, page objects, paper metadata and print-content signals were inspected.");
}

async function analyzeDocx(blob:Blob):Promise<Analysis>{
  const zip=await JSZip.loadAsync(blob);
  const xmlFile=zip.file("word/document.xml"); if(!xmlFile) throw new Error("This DOCX file is missing its main document data.");
  const xml=await xmlFile.async("string");
  const text=(xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)||[]).map(v=>v.replace(/<[^>]+>/g,"").trim()).join(" ");
  const explicit=(xml.match(/<w:lastRenderedPageBreak\b|<w:br[^>]*w:type=["']page["']/g)||[]).length;
  const estimated=Math.max(1,explicit+Math.ceil(text.length/1800));
  const size=xml.match(/<w:pgSz[^>]*w:w=["'](\d+)["'][^>]*w:h=["'](\d+)["']/);
  const paper=size?paperFromTwips(Number(size[1]),Number(size[2])):"Not detected";
  const colorSignals=(xml.match(/w:color=["'](?!auto|000000)[^"']+["']|w:highlight=|<w:shd\b|<a:blip\b/g)||[]).length;
  const density=Math.min(.65,(text.length/Math.max(1,estimated))/4200 + Math.min(.2,explicit*.03));
  return bucket(colorSignals>0,density,estimated,paper,"DOCX XML, explicit page breaks, document size and color/content markers were inspected. Page count is an estimate because browser DOCX layout depends on fonts and printer metrics.");
}

function getPaperRate(paper:string, p:Pricing){
  const value=paper.toLowerCase();
  if(value.includes("legal")) return p.paper_legal_cost;
  if(value.includes("letter")) return p.paper_letter_cost;
  if(value.includes("photo")) return p.paper_photo_cost;
  if(value.includes("sticker")) return p.paper_sticker_cost;
  return p.paper_a4_cost;
}

function computePrice(a:Analysis, p:Pricing, copies:number):Computation{
  if(a.pages <= 0) return { material:0, ink:0, machine:0, labor:0, waste:0, production:0, markup:0, suggested:0 };
  const multiplier=Math.max(1,copies);
  const material=getPaperRate(a.paper,p)*a.pages*multiplier;
  const ink=(a.bwLight*p.bw_light_rate+a.bwMedium*p.bw_medium_rate+a.bwHeavy*p.bw_heavy_rate+a.colorLight*p.color_light_rate+a.colorMedium*p.color_medium_rate+a.colorHeavy*p.color_heavy_rate)*multiplier;
  const machine=a.pages*p.machine_cost_per_page*multiplier;
  const labor=p.labor_cost_per_job;
  const base=material+ink+machine+labor;
  const waste=base*(p.waste_allowance_percent/100);
  const production=base+waste;
  const markup=production*(p.markup_percent/100);
  let suggested=Math.max(p.minimum_job_price,production+markup);
  if(p.round_to>0) suggested=Math.ceil(suggested/p.round_to)*p.round_to;
  return { material, ink, machine, labor, waste, production, markup, suggested };
}

export default function SmartPricingPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const requestedFileId = searchParams.get("fileId") || "";
  const [job, setJob] = useState<Job | null>(null);
  const [file, setFile] = useState<FileItem | null>(null);
  const [pricing, setPricing] = useState<Pricing>(defaultPricing);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [copies, setCopies] = useState(1);
  const [error, setError] = useState("");
  const [settingsWarning, setSettingsWarning] = useState("");
  const [analysis, setAnalysis] = useState<Analysis>(emptyAnalysis);

  useEffect(() => {
    const load = async () => {
      if (!jobId || !requestedFileId) { setError("No selected file was provided for Smart Pricing."); setLoading(false); return; }
      const [{ data, error: loadError }, { data: pricingData, error: pricingError }] = await Promise.all([
        supabase.from("received_file_jobs").select("id, reference_no, customer_name, email, received_file_items(id, original_name, storage_path, mime_type, size_bytes)").eq("id", jobId).single(),
        supabase.from("smart_pricing_settings").select("*").eq("business_id","default").maybeSingle()
      ]);
      if (loadError || !data) { setError(loadError?.message || "Unable to load the Smart Pricing job."); setLoading(false); return; }
      setJob(data as Job);
      const selected = ((data as any).received_file_items || []).find((item: FileItem) => item.id === requestedFileId) || null;
      if (!selected) setError("The selected file no longer exists in this incoming job.");
      setFile(selected);
      if (pricingError) setSettingsWarning("Smart Pricing Settings could not be loaded. Please check the Smart Pricing Settings page and make sure the database setup is active.");
      else if (pricingData) setPricing({ ...defaultPricing, ...pricingData });
      else setSettingsWarning("No Smart Pricing Settings were found yet. Set your paper, ink, production and profit costs first.");
      setLoading(false);
    };
    load();
  }, [jobId, requestedFileId]);

  const computation = useMemo(() => computePrice(analysis, pricing, copies), [analysis, pricing, copies]);

  const runAnalysis = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true); setError("");
    try {
      const { data, error: downloadError } = await supabase.storage.from("received-files").download(file.storage_path);
      if (downloadError || !data) throw new Error(downloadError?.message || "Unable to read the selected file.");
      const name=file.original_name.toLowerCase(); const type=(file.mime_type||"").toLowerCase();
      let result:Analysis;
      if (type.includes("pdf") || name.endsWith(".pdf")) result=await analyzePdf(data);
      else if (type.includes("wordprocessingml") || name.endsWith(".docx")) result=await analyzeDocx(data);
      else if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) result=await analyzeImage(data);
      else result={...emptyAnalysis,pages:1,paper:"Not detected",method:"The file was opened successfully, but this format is not yet supported for automatic page and ink analysis."};
      setAnalysis(result);
    } catch (e:any) {
      setError(e?.message || "Unable to analyze this file.");
    } finally { setAnalyzing(false); }
  };

  const useSmartPrice = () => {
    if (!file || computation.suggested <= 0) return;
    const payload={ fileId:file.id, jobId:job?.id, analysis, copies, pricing, computation, usedAt:new Date().toISOString() };
    sessionStorage.setItem(`printwise-smart-price-${file.id}`,JSON.stringify(payload));
    window.location.href=`/received-files/${jobId}?smartFileId=${encodeURIComponent(file.id)}&smartPrice=${encodeURIComponent(computation.suggested.toFixed(2))}`;
  };

  if (loading) return <div className="app-shell received-shell"><Sidebar /><main className="received-main"><div className="job-loading"><LoaderCircle className="spin" size={30} /><b>Loading selected file…</b></div></main></div>;
  if (error && (!job || !file)) return <div className="app-shell received-shell"><Sidebar /><main className="received-main"><button className="back-btn" onClick={() => (window.location.href = `/received-files/${jobId}`)}><ArrowLeft size={18} /> Back to File Processing</button><div className="job-empty"><FileText size={38} /><h1>Smart Pricing unavailable</h1><p>{error}</p></div></main></div>;
  if (!job || !file) return null;

  const bwPages=analysis.bwLight+analysis.bwMedium+analysis.bwHeavy;
  const colorPages=analysis.colorLight+analysis.colorMedium+analysis.colorHeavy;
  const analyzed=analysis.pages>0;
  const settingsReady=Object.values(pricing).some(v=>typeof v==="number" && v>0);

  return <div className="app-shell received-shell"><Sidebar /><main className="received-main smart-main">
    <div className="job-topbar"><button className="back-btn" onClick={() => (window.location.href = `/received-files/${job.id}`)}><ArrowLeft size={18} /> Back to File Processing</button><button className="settings-link" onClick={() => (window.location.href = "/smart-pricing")}><Settings2 size={17} /> Smart Pricing Settings</button></div>
    <section className="smart-hero"><div><span className="eyebrow">SMART PRICING · FILE ASSESSMENT</span><h1>Analyze and compute this file</h1><p>The file was automatically selected from the Incoming File Job.</p></div><Sparkles size={34} /></section>
    <section className="selected-file-card"><div className="selected-file-icon"><FileText size={28} /></div><div><span className="mini-label">AUTOMATICALLY SELECTED FILE</span><h2>{file.original_name}</h2><p>{file.mime_type || "Unknown file type"} · {(Number(file.size_bytes || 0) / 1024).toFixed(1)} KB</p></div><div className="selected-meta"><span>Customer</span><b>{job.customer_name}</b><span>Reference</span><b>{job.reference_no}</b></div></section>
    {error && <div className="job-error smart-error">{error}</div>}
    {settingsWarning && <div className="settings-warning">{settingsWarning}</div>}
    {!settingsWarning && !settingsReady && <div className="settings-warning">Your Smart Pricing Settings are currently all ₱0.00, so the suggested price will remain ₱0.00 until real costs are entered.</div>}
    <section className="smart-grid"><article className="job-card smart-card"><div className="card-head"><div><span className="mini-label">PHASE 1 · SYSTEM ASSESSMENT</span><h2>Document analysis</h2></div><button className="analyze-btn" onClick={runAnalysis} disabled={analyzing}>{analyzing ? <><LoaderCircle className="spin" size={18} /> ANALYZING...</> : <><Sparkles size={18} /> {analyzed ? "ANALYZE AGAIN" : "ANALYZE FILE"}</>}</button></div><p className="smart-note">The system analyzes the selected file, then sends the detected pages, paper size, color type and ink-coverage results directly into the pricing computation.</p><div className="analysis-grid"><div><small>Pages</small><b>{analyzed?analysis.pages:"—"}</b></div><div><small>Paper Size</small><b>{analysis.paper}</b></div><div><small>B&W Pages</small><b>{analyzed?bwPages:"—"}</b></div><div><small>Color Pages</small><b>{analyzed?colorPages:"—"}</b></div></div><div className="coverage-list"><div><span>B&W Light</span><b>{analysis.bwLight}</b></div><div><span>B&W Medium</span><b>{analysis.bwMedium}</b></div><div><span>B&W Heavy</span><b>{analysis.bwHeavy}</b></div><div><span>Color Light</span><b>{analysis.colorLight}</b></div><div><span>Color Medium</span><b>{analysis.colorMedium}</b></div><div><span>Color Heavy</span><b>{analysis.colorHeavy}</b></div></div>{analyzed && <p className="analysis-method"><b>Analysis result:</b> {analysis.method}</p>}</article>
      <article className="job-card smart-card"><span className="mini-label">PHASE 2 · AUTOMATIC COMPUTATION</span><h2>Suggested price</h2><label className="copies-label">Copies / Quantity<input type="number" min="1" value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} /></label><div className="price-summary"><div><span>Material Cost</span><b>{money(computation.material)}</b></div><div><span>Print / Ink Cost</span><b>{money(computation.ink)}</b></div><div><span>Machine Cost</span><b>{money(computation.machine)}</b></div><div><span>Labor</span><b>{money(computation.labor)}</b></div><div><span>Waste Allowance</span><b>{money(computation.waste)}</b></div><div><span>Production Cost</span><b>{money(computation.production)}</b></div><div><span>Markup</span><b>{money(computation.markup)}</b></div><div className="suggested"><span>SUGGESTED PRICE</span><strong>{money(computation.suggested)}</strong></div></div><button className="use-price-btn" onClick={useSmartPrice} disabled={!analyzed || computation.suggested <= 0}><CheckCircle2 size={18} /> USE SMART PRICE</button><p className="pending-note">Formula: material + analyzed ink + machine + labor + waste allowance + markup, then minimum price and rounding rules are applied.</p></article></section>
  </main><style jsx global>{styles}</style></div>;
}

const styles = `.received-shell{min-height:100vh;background:#f4f6f8}.received-main{width:100%;max-width:1600px;padding:28px 32px 40px;min-width:0}.job-topbar{display:flex;justify-content:space-between;gap:12px;margin-bottom:18px}.back-btn,.settings-link{border:1px solid #dfe3e7;background:#fff;border-radius:11px;padding:11px 15px;color:#373b40;font-weight:750;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.settings-link{color:#8f1f1f}.smart-hero,.selected-file-card,.job-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;box-shadow:0 10px 30px rgba(26,36,46,.05)}.smart-hero{padding:28px;display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px}.eyebrow,.mini-label{font-size:11px;letter-spacing:.14em;font-weight:800;color:#a52a2a}.smart-hero h1{margin:7px 0;font-size:32px;color:#292d32}.smart-hero p{margin:0;color:#747a82}.selected-file-card{padding:20px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:15px;margin-bottom:18px}.selected-file-icon{width:60px;height:60px;border-radius:16px;background:#fff0f0;color:#d61f1f;display:grid;place-items:center}.selected-file-card h2{margin:5px 0;font-size:25px;color:#3d454d}.selected-file-card p{margin:0;color:#747a82}.selected-meta{display:grid;grid-template-columns:auto auto;gap:4px 15px;text-align:right;font-size:13px;color:#747a82}.selected-meta b{color:#3f454c}.settings-warning{background:#fff7e7;border:1px solid #f1d8a3;color:#8b5b00;border-radius:12px;padding:13px 15px;margin-bottom:16px}.smart-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(390px,.8fr);gap:18px}.smart-card{padding:24px}.card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.smart-card h2{margin:8px 0 16px;font-size:25px;color:#363d45}.analyze-btn,.use-price-btn{border:0;border-radius:12px;background:#e31414;color:#fff;font-weight:850;padding:14px 20px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.analyze-btn:disabled,.use-price-btn:disabled{opacity:.45;cursor:not-allowed}.smart-note,.pending-note,.analysis-method{color:#6f7780;line-height:1.55;font-size:14px}.analysis-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.analysis-grid>div{border:1px solid #e0e5e9;border-radius:12px;padding:15px}.analysis-grid small{display:block;color:#6f7780;font-weight:700;margin-bottom:5px}.analysis-grid b{font-size:19px;color:#40464e}.coverage-list{border-top:1px solid #e6e9ec}.coverage-list div{display:flex;justify-content:space-between;padding:10px 4px;border-bottom:1px solid #edf0f2;color:#68717a}.copies-label{display:block;color:#67707a;font-size:12px;font-weight:800}.copies-label input{width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #dfe4e8;border-radius:11px;padding:12px;font-size:16px}.price-summary{margin-top:15px;border:1px solid #e0e4e7;border-radius:14px;overflow:hidden}.price-summary>div{display:flex;justify-content:space-between;padding:13px 15px;border-bottom:1px solid #e8ecef;color:#68717a}.price-summary .suggested{border:0;background:#fff4f4;color:#a92020;font-size:12px;font-weight:850;letter-spacing:.08em;align-items:center}.suggested strong{font-size:28px;letter-spacing:0}.use-price-btn{width:100%;margin-top:16px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.smart-grid{grid-template-columns:1fr}.selected-file-card{grid-template-columns:auto 1fr}.selected-meta{grid-column:1/-1;text-align:left;width:max-content}}@media(max-width:720px){.received-main{padding:18px}.job-topbar{align-items:flex-start;flex-direction:column}.smart-hero{padding:22px}.smart-hero h1{font-size:26px}.selected-file-card{display:flex;flex-wrap:wrap}.selected-file-card h2{font-size:20px}.analysis-grid{grid-template-columns:1fr 1fr}.card-head{flex-direction:column}.analyze-btn{width:100%}}`;