const fs=require('fs');
const path=require('path');
const filePath=path.join(process.cwd(),'app','received-files','[id]','page.tsx');
let source=fs.readFileSync(filePath,'utf8');
if(source.includes('printwise-duplex-v2'))process.exit(0);
const typeOld='type FileSetup={mode:"PRINT"|"EDIT"|"SKIP";paperSize:string;paperQuality:string;colorMode:string;inkCoverage:string;sides:string;copies:number;pages:number;smartPrice?:number;smartApplied?:boolean};';
const typeNew='type FileSetup={mode:"PRINT"|"EDIT"|"SKIP";paperSize:string;paperQuality:string;colorMode:string;inkCoverage:string;sides:string;copies:number;pages:number;smartPrice?:number;smartApplied?:boolean;smartComputation?:{material?:number;ink?:number;machine?:number;labor?:number;waste?:number;production?:number;markup?:number;pageFloor?:number;suggested?:number}};';
if(source.includes(typeOld))source=source.replace(typeOld,typeNew);
const transferOld='type SmartTransfer={fileId:string;jobId?:string;analysis?:{pages?:number;paper?:string;bwLight?:number;bwMedium?:number;bwHeavy?:number;colorLight?:number;colorMedium?:number;colorHeavy?:number};copies?:number;computation?:{suggested?:number};usedAt?:string};';
const transferNew='type SmartTransfer={fileId:string;jobId?:string;analysis?:{pages?:number;paper?:string;bwLight?:number;bwMedium?:number;bwHeavy?:number;colorLight?:number;colorMedium?:number;colorHeavy?:number};copies?:number;computation?:{material?:number;ink?:number;machine?:number;labor?:number;waste?:number;production?:number;markup?:number;pageFloor?:number;suggested?:number};usedAt?:string};';
if(source.includes(transferOld))source=source.replace(transferOld,transferNew);
const priceOld='smartPrice:Number(suggested.toFixed(2)),smartApplied:true};';
const priceNew='smartPrice:Number(suggested.toFixed(2)),smartApplied:true,smartComputation:transfer.computation||undefined};';
if(source.includes(priceOld))source=source.replace(priceOld,priceNew);
const manualOld='const manualChange=changes.some(key=>!["mode"].includes(key));';
const manualNew='const manualChange=changes.some(key=>!["mode","sides"].includes(key));';
if(source.includes(manualOld))source=source.replace(manualOld,manualNew);
const estimateStart=source.indexOf('const estimateFile=(s?:FileSetup)=>{');
const estimateEnd=estimateStart>=0?source.indexOf('};',estimateStart)+2:-1;
if(estimateStart>=0&&estimateEnd>estimateStart){
 const replacement='const estimateFile=(s?:FileSetup)=>{\n  if(!s||s.mode!=="PRINT")return 0;\n  if(s.smartApplied&&Number(s.smartPrice)>0){\n    if(s.sides!=="Double-sided"||!s.smartComputation)return Number(s.smartPrice);\n    const c=s.smartComputation;\n    const pages=Math.max(1,Number(s.pages)||1),copies=Math.max(1,Number(s.copies)||1);\n    const sheetRatio=Math.ceil(pages/2)/pages;\n    const material=Number(c.material||0)*sheetRatio;\n    const ink=Number(c.ink||0),machine=Number(c.machine||0),labor=Number(c.labor||0);\n    const originalBase=Number(c.material||0)+Number(c.ink||0)+Number(c.machine||0)+Number(c.labor||0);\n    const originalProduction=Number(c.production||originalBase);\n    const wasteRate=originalBase>0?Number(c.waste||0)/originalBase:0;\n    const markupRate=originalProduction>0?Number(c.markup||0)/originalProduction:0;\n    const base=material+ink+machine+labor;\n    const waste=base*wasteRate;\n    const production=base+waste;\n    const markup=production*markupRate;\n    const pageFloor=Number(c.pageFloor||0);\n    const duplex=Math.max(pageFloor,production+markup);\n    return Number(Math.min(Number(s.smartPrice),duplex).toFixed(2));\n  }\n  let rate=s.colorMode==="Colored"?8:2;\n  if(s.paperSize==="Legal")rate+=1.5;if(s.paperSize==="Letter")rate+=.5;if(s.paperQuality==="Premium")rate+=2;if(s.paperQuality==="Photo")rate+=8;\n  if(s.inkCoverage==="Heavy")rate+=s.colorMode==="Colored"?3:1;if(s.inkCoverage==="Light")rate-=.25;\n  const pages=Math.max(s.pages,1),copies=Math.max(s.copies,1),sheets=s.sides==="Double-sided"?Math.ceil(pages/2):pages;\n  return Math.max(rate,0)*sheets*copies;\n};';
 source=source.slice(0,estimateStart)+replacement+source.slice(estimateEnd);
}
const marker='<label>Print Sides<select value={s.sides} onChange={e=>updateSetup(file.id,{sides:e.target.value})}><option>Single-sided</option><option>Double-sided</option></select></label><label>Estimated Pages';
if(source.includes(marker)){
 const ui='<label>Print Sides<select value={s.sides} onChange={e=>updateSetup(file.id,{sides:e.target.value})}><option>Single-sided</option><option>Double-sided</option></select></label><div style={{display:"flex",alignItems:"end",paddingBottom:8,fontSize:12,color:"#64748b"}}>{s.sides==="Double-sided"?`${Math.ceil(Math.max(1,s.pages)/2)*Math.max(1,s.copies)} physical sheet${Math.ceil(Math.max(1,s.pages)/2)*Math.max(1,s.copies)===1?"":"s"}`:`${Math.max(1,s.pages)*Math.max(1,s.copies)} physical sheet${Math.max(1,s.pages)*Math.max(1,s.copies)===1?"":"s"}`}</div><label>Estimated Pages';
 source=source.replace(marker,ui);
}
source=source.replace('return Math.max(rate,0)*Math.max(s.pages,1)*Math.max(s.copies,1);','const sheets=s.sides==="Double-sided"?Math.ceil(Math.max(1,s.pages)/2):Math.max(1,s.pages); return Math.max(rate,0)*sheets*Math.max(s.copies,1);');
source=source.replace('/* printwise-duplex-v2 */','');
source+='\n// printwise-duplex-v2\n';
fs.writeFileSync(filePath,source,'utf8');
console.log('PrintWise: duplex pricing v2 patched.');
