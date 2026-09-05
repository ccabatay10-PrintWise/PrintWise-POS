const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise POS Erase confirmation */";

if (!page.includes(marker)) {
  const stateNeedle = '  const [paymentModalOpen, setPaymentModalOpen] = useState(false);';
  if (!page.includes(stateNeedle)) throw new Error("Payment modal state marker not found.");
  page = page.replace(stateNeedle, `${stateNeedle}\n  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);`);

  const clearNeedle = '  const clearOrder = () => {';
  if (!page.includes(clearNeedle)) throw new Error("clearOrder marker not found.");
  page = page.replace(clearNeedle, `  const requestClearOrder = () => {\n    if (!cart.length) {\n      setMessage("There is no current order to erase.");\n      return;\n    }\n    setEraseConfirmOpen(true);\n  };\n\n${clearNeedle}`);

  const quickNeedle = 'onClick={clearOrder} title="Erase current order"';
  if (!page.includes(quickNeedle)) throw new Error("Erase quick action marker not found.");
  page = page.replace(quickNeedle, 'onClick={requestClearOrder} title="Erase current order"');

  const closeMain = '\n    </main>\n  );';
  if (!page.includes(closeMain)) throw new Error("POS main closing marker not found.");
  const modal = `\n\n      {eraseConfirmOpen && (\n        <div className="pw-erase-overlay" role="dialog" aria-modal="true" aria-labelledby="pw-erase-title">\n          <div className="pw-erase-card">\n            <button type="button" className="pw-erase-close" onClick={() => setEraseConfirmOpen(false)} aria-label="Close"><X size={22} /></button>\n            <div className="pw-erase-heading"><Trash2 size={25} /><h2 id="pw-erase-title">Clear Order</h2></div>\n            <p>Are you sure you want to clear the current order? This action cannot be undone.</p>\n            <div className="pw-erase-actions">\n              <button type="button" className="pw-erase-cancel" onClick={() => setEraseConfirmOpen(false)}>Cancel</button>\n              <button type="button" className="pw-erase-confirm" onClick={() => { setEraseConfirmOpen(false); clearOrder(); }}>Clear Order</button>\n            </div>\n          </div>\n        </div>\n      )}${marker}`;
  page = page.replace(closeMain, modal + closeMain);
  fs.writeFileSync(pagePath, page, "utf8");
}

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.pw-erase-overlay{position:fixed;inset:0;z-index:10020;background:rgba(18,24,33,.72);backdrop-filter:blur(5px);display:grid;place-items:center;padding:20px}.pw-erase-card{position:relative;width:min(100%,560px);box-sizing:border-box;background:#fff;border-radius:15px;padding:30px 31px;box-shadow:0 28px 80px rgba(0,0,0,.3)}.pw-erase-close{position:absolute;right:15px;top:15px;width:36px;height:36px;border:0;background:transparent;color:#69717c;border-radius:8px;display:grid;place-items:center;cursor:pointer}.pw-erase-heading{display:flex;align-items:center;gap:15px}.pw-erase-heading svg{color:#ff1717;stroke-width:2}.pw-erase-heading h2{margin:0;color:#292d33;font-size:24px;line-height:1.2}.pw-erase-card p{margin:14px 0 21px;color:#737784;font-size:17px;line-height:1.45;max-width:490px}.pw-erase-actions{display:flex;justify-content:flex-end;gap:10px}.pw-erase-cancel,.pw-erase-confirm{min-width:100px;height:46px;border-radius:10px;padding:0 18px;font-size:16px;font-weight:700;cursor:pointer}.pw-erase-cancel{border:1px solid #dfe2e6;background:#fff;color:#363b42}.pw-erase-confirm{border:0;background:#ff1717;color:#fff;min-width:138px}.pw-erase-confirm:hover{background:#e91414}@media(max-width:600px){.pw-erase-card{padding:27px 22px}.pw-erase-card p{font-size:15px}.pw-erase-actions{width:100%}.pw-erase-cancel,.pw-erase-confirm{flex:1}}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}
console.log("PrintWise: Erase now requires confirmation before clearing the current order.");
