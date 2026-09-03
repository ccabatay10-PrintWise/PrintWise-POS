const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");

let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const marker = "/* PrintWise POS quick action rail */";

if (!page.includes("className=\"pos-quick-actions\"")) {
  page = page.replace(
    "Banknote, Barcode, CheckCircle2, CreditCard, FileText, Image, LogIn, Menu, Minus,\n  PenLine, Phone, Plus, Printer, ReceiptText, Search, Shirt, ShoppingCart, Sticker,\n  Trash2, Users, X, CupSoda, Layers3",
    "Banknote, Barcode, CheckCircle2, CreditCard, FileText, Image, LogIn, Menu, Minus,\n  PenLine, Phone, Plus, Printer, ReceiptText, Search, Shirt, ShoppingCart, Sticker,\n  Trash2, Users, X, CupSoda, Layers3, Percent, ClipboardList, Clock3, Eraser, Settings2, RefreshCw"
  );

  const oldEnd = `          </aside>\n        </div>`;
  const newEnd = `          </aside>\n\n          <div className="pos-quick-actions" aria-label="Order quick actions">\n            <button type="button" className="pos-quick-action" onClick={() => setDiscount(discountAmount)} title="Apply discount">\n              <Percent size={22} />\n              <span>Discount</span>\n            </button>\n            <button type="button" className="pos-quick-action" title="View orders">\n              <ClipboardList size={22} />\n              <span>Orders</span>\n            </button>\n            <button type="button" className="pos-quick-action pos-quick-action-active" title="Shift">\n              <Clock3 size={22} />\n              <span>Shift</span>\n            </button>\n            <button type="button" className="pos-quick-action" onClick={clearOrder} title="Clear current order">\n              <Eraser size={22} />\n              <span>Clear</span>\n            </button>\n            <button type="button" className="pos-quick-action" onClick={() => window.print()} title="Print">\n              <Printer size={22} />\n              <span>Printer</span>\n            </button>\n            <button type="button" className="pos-quick-action" title="POS settings">\n              <Settings2 size={22} />\n              <span>Settings</span>\n            </button>\n            <button type="button" className="pos-quick-action" onClick={() => window.location.reload()} title="Refresh POS">\n              <RefreshCw size={22} />\n              <span>Refresh</span>\n            </button>\n          </div>\n        </div>`;
  if (!page.includes(oldEnd)) throw new Error("POS order panel marker not found");
  page = page.replace(oldEnd, newEnd);
  fs.writeFileSync(pagePath, page, "utf8");
}

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.pos-layout{grid-template-columns:minmax(0,1fr) minmax(360px,430px) 74px;gap:0}\n.pos-quick-actions{display:flex;flex-direction:column;gap:10px;padding:12px 8px 12px 10px;border-left:1px solid #dbe3ec;background:#f7f9fc;min-width:74px}\n.pos-quick-action{width:58px;min-height:68px;padding:8px 4px;border:1px solid #dbe3ec;border-radius:12px;background:#fff;color:#405773;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font:600 10px/1.1 inherit;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.03);transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease,color .15s ease}\n.pos-quick-action svg{stroke-width:1.8}\n.pos-quick-action:hover{transform:translateY(-1px);border-color:#c5d2df;box-shadow:0 3px 8px rgba(16,24,40,.07)}\n.pos-quick-action-active{color:#079b62;border-color:#11d79a;background:#f2fffa}\n@media(max-width:1100px){.pos-layout{grid-template-columns:minmax(0,1fr) minmax(320px,390px) 68px}.pos-quick-actions{min-width:68px;padding-left:7px;padding-right:5px}.pos-quick-action{width:54px;min-height:64px}}\n@media(max-width:850px){.pos-layout{grid-template-columns:minmax(0,1fr) 340px}.pos-quick-actions{grid-column:2;grid-row:2;flex-direction:row;overflow-x:auto;border-left:0;border-top:1px solid #dbe3ec;padding:8px}.pos-quick-action{flex:0 0 58px}}\n@media(max-width:700px){.pos-layout{grid-template-columns:1fr}.pos-quick-actions{grid-column:auto;grid-row:auto;order:3}.order-panel{min-height:520px}}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Added the POS quick-action rail beside Current Order.");
