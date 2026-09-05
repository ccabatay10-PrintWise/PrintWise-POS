const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");

let page = fs.readFileSync(pagePath, "utf8");
const oldSummary = `<div className="summary">\n              <div><span>Total Price</span><b>₱{subtotal.toFixed(2)}</b></div>\n              <div className="discount-row"><span>Discount</span><input type="number" min="0" max={subtotal} value={discount || ""} onChange={(e) => setDiscount(Math.min(subtotal, Math.max(0, Number(e.target.value) || 0)))} placeholder="0.00" /></div>\n              <div className="total-row"><span>Amount Due</span><b>₱{total.toFixed(2)}</b></div>\n            </div>`;
const newSummary = `<div className="summary">\n              <div><span>Subtotal</span><b>₱{subtotal.toFixed(2)}</b></div>\n              <div className="discount-row"><span>Discounts</span><b className="discount-value">₱{discountAmount.toFixed(2)}</b></div>\n              <div className="total-row"><span>Total</span><b>₱{total.toFixed(2)}</b></div>\n            </div>`;

if (page.includes(oldSummary)) {
  page = page.replace(oldSummary, newSummary);
  fs.writeFileSync(pagePath, page, "utf8");
}

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise final summary totals interface */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.summary{margin:0!important;padding:18px 15px 0!important;border-top:1px solid #dfe4ea!important;background:#fff!important}\n.summary>div{margin:0!important;min-height:36px;font-size:14px!important;box-sizing:border-box}\n.summary span{color:#344054!important;font-size:14px!important;font-weight:500!important}\n.summary b{color:#101828!important;font-size:14px!important;font-weight:600!important}\n.summary .discount-row{padding:0!important}\n.summary .discount-value{display:inline-flex;align-items:center;justify-content:flex-end;min-width:76px;height:32px;box-sizing:border-box;color:#101828!important}\n.summary .total-row{margin:5px -15px 0!important;padding:12px 15px 10px!important;border-top:1px solid #dfe4ea!important;min-height:58px;font-size:22px!important;font-weight:700!important}\n.summary .total-row span{font-size:22px!important;font-weight:700!important;color:#101828!important}\n.summary .total-row b{font-size:22px!important;font-weight:700!important;color:#101828!important}\n.summary input{pointer-events:none}\n@media(max-width:1100px){.summary{padding-left:12px!important;padding-right:12px!important}.summary .total-row{margin-left:-12px!important;margin-right:-12px!important;padding-left:12px!important;padding-right:12px!important}}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied the final Subtotal / Discounts / Total interface.");
