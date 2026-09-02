const fs = require("fs");
const path = require("path");
const root = process.cwd();

function patchSmartPricing() {
  const smartPath = path.join(root, "app", "received-files", "[id]", "smart-pricing", "page.tsx");
  let smart = fs.readFileSync(smartPath, "utf8");

  // Replace only the existing useSmartPrice function through its navigation line.
  // Do not match on `};`, because the handler contains several object literals.
  const handler = /const\s+useSmartPrice\s*=\s*\(\)\s*=>\s*\{[\s\S]*?window\.location\.href\s*=\s*[^;]+;\s*\}?/;
  const replacement = 'const useSmartPrice=()=>{if(!file||computation.suggested<=0)return;sessionStorage.setItem(`printwise-smart-price-${file.id}`,JSON.stringify({fileId:file.id,jobId:job?.id,analysis,copies,sides,pricing,computation,usedAt:new Date().toISOString()}));const handoff={jobId:job?.id||jobId,referenceNo:job?.reference_no||"",customerName:job?.customer_name||"",contactNumber:"",items:[{id:`received-file-${file.id}`,name:file.original_name,price:Number(computation.suggested.toFixed(2)),quantity:Math.max(1,copies)}]};sessionStorage.setItem("printwise_received_file_cart",JSON.stringify(handoff));window.location.href="/pos";};';

  if (handler.test(smart)) {
    smart = smart.replace(handler, replacement);
  } else if (!smart.includes('window.location.href="/pos"')) {
    throw new Error("PrintWise: Smart Pricing useSmartPrice handler was not found; refusing to patch.");
  }

  // Safety guard: the generated handler must be closed before the next top-level statement.
  smart = smart.replace(/(window\.location\.href="\/pos";)(?!\s*\})/, '$1};');

  smart = smart.replace(/Back to File Processing/g, "Back to Incoming Files");
  smart = smart.replace(/> USE SMART PRICE<\/button>/g, "> USE SMART PRICING AMOUNT</button>");
  fs.writeFileSync(smartPath, smart, "utf8");
}

function patchPos() {
  const posPath = path.join(root, "app", "pos", "page.tsx");
  let pos = fs.readFileSync(posPath, "utf8");

  const lucideImport = pos.match(/import \{([^}]+)\} from ["']lucide-react["'];/);
  if (lucideImport && !/\bPlus\b/.test(lucideImport[1])) {
    const icons = lucideImport[1].trim();
    pos = pos.replace(lucideImport[0], `import { Plus, ${icons} } from "lucide-react";`);
  }

  if (!/const addTransaction\s*=/.test(pos)) {
    const clear = pos.match(/const clearOrder\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};/);
    if (clear) {
      const addition = `${clear[0]}

  const addTransaction = () => {
    if (cart.length && !window.confirm("Start a new transaction? The current unpaid order will be cleared.")) return;
    clearOrder();
  };`;
      pos = pos.replace(clear[0], addition);
    }
  }

  if (!pos.includes('className="add-transaction-btn"')) {
    const actionMarker = pos.indexOf('className="top-actions"');
    if (actionMarker >= 0) {
      const insertAt = pos.indexOf(">", actionMarker) + 1;
      if (insertAt > 0) {
        pos = pos.slice(0, insertAt) + '<button className="add-transaction-btn" type="button" onClick={addTransaction}><Plus size={17} /> ADD TRANSACTION</button>' + pos.slice(insertAt);
      }
    }
  }

  if (!pos.includes("printwise_received_file_cart")) {
    const returnAt = pos.indexOf("return (");
    if (returnAt >= 0) {
      const effect = `useEffect(() => {
    const raw = sessionStorage.getItem("printwise_received_file_cart");
    if (!raw) return;
    try {
      const handoff = JSON.parse(raw);
      if (handoff?.items?.length) {
        setCart(handoff.items);
        if (handoff.customerName) setCustomer(handoff.customerName);
      }
      sessionStorage.removeItem("printwise_received_file_cart");
    } catch {
      sessionStorage.removeItem("printwise_received_file_cart");
    }
  }, []);

  `;
      pos = pos.slice(0, returnAt) + effect + pos.slice(returnAt);
    }
  }

  fs.writeFileSync(posPath, pos, "utf8");
}

function patchCss() {
  const cssPath = path.join(root, "app", "pos", "pos.css");
  let css = fs.readFileSync(cssPath, "utf8");
  if (!css.includes(".add-transaction-btn{")) css += '\n.add-transaction-btn{border:0;background:#d71920;color:#fff;border-radius:10px;padding:10px 14px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(215,25,32,.16)}.add-transaction-btn:hover{background:#bb1118}.add-transaction-btn:active{transform:translateY(1px)}@media(max-width:700px){.add-transaction-btn{padding:9px 10px}.add-transaction-btn svg{width:15px;height:15px}}\n';
  fs.writeFileSync(cssPath, css, "utf8");
}

patchSmartPricing();
patchPos();
patchCss();
console.log("PrintWise: Smart Pricing POS handoff and POS Add Transaction workflow patched.");
