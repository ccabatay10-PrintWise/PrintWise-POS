const fs = require("fs");
const path = require("path");
const filePath = path.join(process.cwd(), "app", "received-files", "[id]", "page.tsx");
let source = fs.readFileSync(filePath, "utf8");

const heroRegex = /<section className="job-hero">[\s\S]*?<\/section>/;
const newHero = `  <section className="job-hero incoming-file-job"><div className="incoming-job-main"><div className="incoming-job-heading"><div><span className="eyebrow">INCOMING FILE JOB</span><h1>{job.reference_no}</h1><p>Received {date}</p></div><span className={\`status \${job.status.toLowerCase()}\`}>{job.status.replaceAll("_"," ")}</span></div><div className="incoming-file-list">{files.map((file,index)=>{const s=setups[file.id]??defaultSetup();const est=estimateFile(s);return <article className="incoming-file-item" key={file.id}><div className="incoming-file-info"><span className="file-number">{index+1}</span><span className="file-icon"><FileText size={20}/></span><div><b>{file.original_name}</b><small>{file.mime_type||"Unknown file type"} · {formatBytes(Number(file.size_bytes||0))}</small></div></div><div className="incoming-file-actions"><button onClick={()=>openFile(file)}><ExternalLink size={16}/> Open</button><button onClick={()=>openFile(file,true)}><Download size={16}/> Download</button><button className="smart-pricing-btn" onClick={()=>goToSmartPricing(file)}><Sparkles size={16}/> Smart Pricing</button>{s.smartApplied&&<div className="incoming-smart-price"><small>Smart Price</small><b>{money(est)}</b><span>{Math.max(1,s.pages)} page × {Math.max(1,s.copies)} copy</span></div>}</div></article>})}</div></div></section>`;

if (!source.includes("incoming-file-job")) {
  if (!heroRegex.test(source)) throw new Error("PrintWise: Incoming File Job hero section was not found.");
  source = source.replace(heroRegex, newHero);
}

if (source.includes("files-card")) {
  const filesRegex = /<section className="job-card files-card">[\s\S]*?<\/section>/;
  if (!filesRegex.test(source)) throw new Error("PrintWise: File Processing section was not found.");
  source = source.replace(filesRegex, "");
}

const css = `.incoming-file-job{padding:24px}.incoming-job-main{width:100%}.incoming-job-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.incoming-file-list{margin-top:22px;border-top:1px solid #e6eaee}.incoming-file-item{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 0;border-bottom:1px solid #e6eaee}.incoming-file-info{display:flex;align-items:center;gap:12px;min-width:0}.incoming-file-info>div{min-width:0}.incoming-file-info b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.incoming-file-info small{display:block;color:#7b858e;margin-top:4px}.incoming-file-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.incoming-file-actions button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 14px;border:1px solid #dce2e7;border-radius:10px;background:#fff;font-weight:800;font-size:13px;cursor:pointer}.incoming-file-actions .smart-pricing-btn{background:#f00;color:#fff;border-color:#f00}.incoming-smart-price{display:flex;flex-direction:column;min-width:118px;padding:9px 12px;border:1px solid #ffc9c9;border-radius:10px;background:#fff7f7}.incoming-smart-price small{font-size:11px;color:#777}.incoming-smart-price b{font-size:18px;color:#f00}.incoming-smart-price span{font-size:10px;color:#777;margin-top:2px}@media(max-width:760px){.incoming-file-item{align-items:flex-start;flex-direction:column}.incoming-file-actions{width:100%;justify-content:flex-start}.incoming-file-actions button{flex:1}.incoming-smart-price{min-width:0}.incoming-job-heading{flex-direction:column}}`;

if (!source.includes(".incoming-file-job{")) {
  const styleMatch = source.match(/const styles=`([\s\S]*?)`;/);
  if (!styleMatch) throw new Error("PrintWise: Received Files styles block was not found.");
  source = source.replace(styleMatch[0], `const styles=\`${styleMatch[1]}${css}\`;`);
}

fs.writeFileSync(filePath, source, "utf8");
console.log("PrintWise: Incoming File Job UI consolidated successfully.");
