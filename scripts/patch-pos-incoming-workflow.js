const fs = require("fs");
const path = require("path");
const root = process.cwd();

function replaceOnce(source, regex, replacement, label) {
  if (regex.test(source)) return source.replace(regex, replacement);
  if (source.includes(label)) return source;
  throw new Error(`PrintWise: ${label} marker was not found; refusing to patch.`);
}

const smartPath = path.join(root, "app", "received-files", "[id]", "smart-pricing", "page.tsx");
let smart = fs.readFileSync(smartPath, "utf8");

// Match the handler regardless of whether an earlier patch ended it with ; or not.
const smartHandler = /const useSmartPrice=\(\)=>\{[\s\S]*?\}(?:;)?(?=if\(loading\)|if\(!job\|\|!file\))/;
const newUseSmartPrice = 'const useSmartPrice=()=>{if(!file||computation.suggested<=0)return;const handoff={jobId:job?.id||jobId,referenceNo:job?.reference_no||"",customerName:job?.customer_name||"",contactNumber:"",items:[{id:`received-file-${file.id}`,name:file.original_name,price:Number(computation.suggested.toFixed(2)),quantity:Math.max(1,copies)}]};sessionStorage.setItem("printwise_received_file_cart",JSON.stringify(handoff));sessionStorage.setItem(`printwise-smart-price-${file.id}`,JSON.stringify({fileId:file.id,jobId:job?.id,analysis,copies,pricing,computation,usedAt:new Date().toISOString()}));window.location.href="/pos"};';
smart = replaceOnce(smart, smartHandler, newUseSmartPrice, "Smart Pricing POS handoff");
smart = smart.replace(/window\.location\.href=`\/received-files\/\$\{jobId\}`/g, 'window.location.href="/received-files"');
smart = smart.replace(/window\.location\.href=`\/received-files\/\$\{job\.id\}`/g, 'window.location.href="/received-files"');
smart = smart.replace(/Back to File Processing/g, 'Back to Incoming Files');
smart = smart.replace(/> USE SMART PRICE<\/button>/g, '> USE SMART PRICING AMOUNT</button>');
fs.writeFileSync(smartPath, smart, "utf8");

const posPath = path.join(root, "app", "pos", "page.tsx");
let pos = fs.readFileSync(posPath, "utf8");

const clearMarker = /const clearOrder = \(\) => \{[\s\S]*?\};/;
if (!/const addTransaction = \(\)/.test(pos)) {
  pos = replaceOnce(pos, clearMarker, (match) => `${match}\n\n  const addTransaction = () => {\n    if (cart.length && !window.confirm("Start a new transaction? The current unpaid order will be cleared.")) return;\n    clearOrder();\n  };`, "POS Add Transaction handler");
}

const topActions = /<div className="top-actions">[\s\S]*?<\/div><\/div>/;
if (!pos.includes('className="add-transaction-btn"')) {
  pos = replaceOnce(pos, topActions, '<div className="top-actions"><button className="add-transaction-btn" type="button" onClick={addTransaction}><Plus size={17} /> ADD TRANSACTION</button><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div></div>', "POS Add Transaction button");
}
fs.writeFileSync(posPath, pos, "utf8");

const cssPath = path.join(root, "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes('.add-transaction-btn{')) css += '\n.add-transaction-btn{border:0;background:#d71920;color:#fff;border-radius:10px;padding:10px 14px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(215,25,32,.16)}.add-transaction-btn:hover{background:#bb1118}.add-transaction-btn:active{transform:translateY(1px)}@media(max-width:700px){.add-transaction-btn{padding:9px 10px}.add-transaction-btn svg{width:15px;height:15px}}\n';
fs.writeFileSync(cssPath, css, "utf8");

console.log("PrintWise: Smart Pricing now hands the selected amount directly to POS; POS has Add Transaction.");
