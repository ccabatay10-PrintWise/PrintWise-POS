const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const marker = "/* PrintWise POS discount selection modal */";
if (!page.includes(marker)) {
  page = page.replace(
    "Trash2, Users, X, CupSoda, Layers3",
    "Trash2, Users, X, CupSoda, Layers3, UserRound, Accessibility, Trophy, UsersRound, Percent, PhilippinePeso"
  );

  page = page.replace(
    'const [discount, setDiscount] = useState(0);',
    'const [discount, setDiscount] = useState(0);\n  const [discountModalOpen, setDiscountModalOpen] = useState(false);\n  const [selectedDiscount, setSelectedDiscount] = useState(\"\");\n  const [discountRate, setDiscountRate] = useState(0);\n  const [customDiscountType, setCustomDiscountType] = useState<\"percentage\" | \"amount\">(\"percentage\");\n  const [customDiscountValue, setCustomDiscountValue] = useState(0);'
  );

  page = page.replace(
    'const clearOrder = () => {',
    'const openDiscountModal = () => {\n    setSelectedDiscount(\"\");\n    setDiscountRate(0);\n    setCustomDiscountType(\"percentage\");\n    setCustomDiscountValue(0);\n    setDiscountModalOpen(true);\n  };\n\n  const applySelectedDiscount = () => {\n    if (!subtotal) return;\n    let amount = 0;\n    if (selectedDiscount === \"Senior\" || selectedDiscount === \"PWD\") amount = subtotal * (discountRate / 100);\n    else if (selectedDiscount === \"National Athlete\") amount = subtotal * 0.20;\n    else if (selectedDiscount === \"Solo Parent\") amount = subtotal * 0.10;\n    else if (selectedDiscount === \"Percentage\") amount = subtotal * (Math.min(100, Math.max(0, customDiscountValue)) / 100);\n    else if (selectedDiscount === \"Amount\") amount = Math.min(subtotal, Math.max(0, customDiscountValue));\n    setDiscount(Math.max(0, Math.min(subtotal, amount)));\n    setDiscountModalOpen(false);\n  };\n\n  const clearOrder = () => {'
  );

  page = page.replace(
    '<button className="pos-quick-action" onClick={() => setDiscount(discountAmount)} title="Apply discount">',
    '<button className="pos-quick-action" onClick={openDiscountModal} title="Apply discount">'
  );

  const modal = `
        {discountModalOpen && <div className="discount-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="discount-modal-title">
          <div className="discount-modal-card">
            <button className="discount-modal-close" onClick={() => setDiscountModalOpen(false)} aria-label="Close discount window"><X size={21} /></button>
            <div className="discount-modal-header">
              <h2 id="discount-modal-title">Select Discount</h2>
              <p>This will be applied to all line items</p>
            </div>
            <div className="discount-modal-body">
              <div className="discount-options">
                <section className="discount-group">
                  <div className="discount-group-heading"><h3>GOVERNMENT DISCOUNTS</h3><p>For eligible customers with valid government-issued proof.</p></div>
                  <div className="discount-card-grid">
                    <button className={\`discount-option-card \${selectedDiscount === "Senior" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("Senior"); setDiscountRate(20); }}><span className="discount-option-icon"><UserRound size={22} /></span><b>Senior</b><small>5% or 20% off</small></button>
                    <button className={\`discount-option-card \${selectedDiscount === "PWD" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("PWD"); setDiscountRate(20); }}><span className="discount-option-icon"><Accessibility size={22} /></span><b>PWD</b><small>5% or 20% off</small></button>
                    <button className={\`discount-option-card \${selectedDiscount === "National Athlete" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("National Athlete"); setDiscountRate(20); }}><span className="discount-option-icon"><Trophy size={22} /></span><b>National Athlete</b><small>20% off</small></button>
                    <button className={\`discount-option-card \${selectedDiscount === "Solo Parent" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("Solo Parent"); setDiscountRate(10); }}><span className="discount-option-icon"><UsersRound size={22} /></span><b>Solo Parent</b><small>10% off</small></button>
                  </div>
                </section>
                <section className="discount-group">
                  <div className="discount-group-heading"><h3>CUSTOM DISCOUNTS</h3><p>Manual discount value for promos and discretionary cases.</p></div>
                  <div className="discount-card-grid custom-grid">
                    <button className={\`discount-option-card \${selectedDiscount === "Percentage" ? "selected" : ""}\`} onClick={() => setSelectedDiscount("Percentage")}><span className="discount-option-icon"><Percent size={22} /></span><b>Percentage</b><small>% off item total</small></button>
                    <button className={\`discount-option-card \${selectedDiscount === "Amount" ? "selected" : ""}\`} onClick={() => setSelectedDiscount("Amount")}><span className="discount-option-icon"><PhilippinePeso size={22} /></span><b>Amount</b><small>Fixed peso amount</small></button>
                  </div>
                </section>
              </div>
              <div className="discount-detail-panel">
                {!selectedDiscount && <span>Select a discount type to see additional options.</span>}
                {(selectedDiscount === "Senior" || selectedDiscount === "PWD") && <div className="discount-detail-content"><h3>{selectedDiscount} Discount</h3><p>Select the applicable discount rate.</p><div className="discount-rate-grid"><button className={discountRate === 5 ? "selected" : ""} onClick={() => setDiscountRate(5)}>5% OFF</button><button className={discountRate === 20 ? "selected" : ""} onClick={() => setDiscountRate(20)}>20% OFF</button></div><small>Apply only after verifying valid government-issued proof.</small></div>}
                {selectedDiscount === "National Athlete" && <div className="discount-detail-content"><h3>National Athlete</h3><p>Fixed government discount.</p><div className="discount-fixed-rate">20% OFF</div></div>}
                {selectedDiscount === "Solo Parent" && <div className="discount-detail-content"><h3>Solo Parent</h3><p>Fixed government discount.</p><div className="discount-fixed-rate">10% OFF</div></div>}
                {(selectedDiscount === "Percentage" || selectedDiscount === "Amount") && <div className="discount-detail-content"><h3>{selectedDiscount} Discount</h3><p>Enter the discount to apply to this order.</p><label>{selectedDiscount === "Percentage" ? "Percentage" : "Peso Amount"}<div className="discount-input-wrap"><span>{selectedDiscount === "Percentage" ? "%" : "₱"}</span><input type="number" min="0" max={selectedDiscount === "Percentage" ? 100 : subtotal} step="0.01" value={customDiscountValue || ""} onChange={(e) => setCustomDiscountValue(Math.max(0, Number(e.target.value) || 0))} placeholder="0.00" /></div></label></div>}
              </div>
            </div>
            <button className="discount-apply-btn" disabled={!selectedDiscount || !subtotal} onClick={applySelectedDiscount}>Apply Discount</button>
          </div>
        </div>}
`;

  const paymentMarker = '        {paymentModalOpen && <div className="payment-modal-overlay"';
  if (!page.includes(paymentMarker)) throw new Error("Payment modal marker not found");
  page = page.replace(paymentMarker, modal + paymentMarker);
  fs.writeFileSync(pagePath, page, "utf8");
}

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.discount-modal-overlay{position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.70);display:flex;align-items:center;justify-content:center;padding:18px}\n.discount-modal-card{position:relative;width:min(934px,96vw);max-height:94vh;overflow:auto;background:#fff;border:1px solid #d9e2ec;border-radius:14px;box-shadow:0 24px 70px rgba(15,23,42,.24);padding:28px 30px 30px;color:#172033}\n.discount-modal-close{position:absolute;right:18px;top:17px;border:0;background:transparent;color:#667085;cursor:pointer;padding:6px;border-radius:8px}\n.discount-modal-close:hover{background:#f2f4f7}\n.discount-modal-header h2{margin:0;font-size:23px;font-weight:700;letter-spacing:-.3px}\n.discount-modal-header p{margin:7px 0 0;color:#667085;font-size:15px}\n.discount-modal-body{display:grid;grid-template-columns:450px minmax(0,1fr);gap:28px;margin-top:28px}\n.discount-options{padding-right:28px;border-right:1px solid #e5eaf0}\n.discount-group+.discount-group{margin-top:20px}\n.discount-group-heading h3{margin:0;color:#587394;font-size:14px;font-weight:600;letter-spacing:.1px}\n.discount-group-heading p{margin:5px 0 14px;color:#5f7795;font-size:13px;line-height:1.4}\n.discount-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.discount-option-card{min-height:112px;border:1px solid #d9e5ef;border-radius:15px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#2f3742;cursor:pointer;box-shadow:0 2px 4px rgba(16,24,40,.05);transition:.15s ease}\n.discount-option-card:hover,.discount-option-card.selected{border-color:#b9cce0;background:#f7fafc;box-shadow:0 4px 10px rgba(16,24,40,.07);transform:translateY(-1px)}\n.discount-option-icon{width:36px;height:36px;border-radius:50%;background:#eef4f8;display:flex;align-items:center;justify-content:center;color:#29343f}\n.discount-option-card b{font-size:14px;font-weight:500}.discount-option-card small{font-size:12px;color:#587394;font-weight:500}\n.discount-detail-panel{min-height:390px;display:flex;align-items:center;justify-content:center;color:#87a2bf;font-size:15px;text-align:center;padding:18px}\n.discount-detail-content{width:min(330px,100%);text-align:left}.discount-detail-content h3{margin:0 0 6px;font-size:18px;color:#26384d}.discount-detail-content p{margin:0 0 18px;color:#667085;font-size:13px}.discount-rate-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.discount-rate-grid button,.discount-fixed-rate{height:48px;border:1px solid #d9e5ef;border-radius:10px;background:#fff;color:#405773;font-weight:600;cursor:pointer}.discount-rate-grid button.selected{background:#f1f5f8;border-color:#94a9bd}.discount-fixed-rate{display:flex;align-items:center;justify-content:center;font-size:18px}.discount-detail-content small{display:block;margin-top:14px;color:#8a96a5;font-size:11px;line-height:1.4}.discount-detail-content label{display:block;color:#52657c;font-size:12px;font-weight:600}.discount-input-wrap{height:48px;margin-top:7px;border:1px solid #d7e0e9;border-radius:9px;display:flex;align-items:center;overflow:hidden}.discount-input-wrap span{padding:0 12px;color:#667085;background:#f7f8fa;height:100%;display:flex;align-items:center}.discount-input-wrap input{border:0;outline:0;width:100%;height:100%;padding:0 12px;font-size:15px}.discount-apply-btn{width:100%;height:46px;margin-top:22px;border:0;border-radius:9px;background:#0b96df;color:#fff;font-size:15px;font-weight:700;cursor:pointer}.discount-apply-btn:disabled{opacity:.45;cursor:not-allowed}\n@media(max-width:800px){.discount-modal-body{grid-template-columns:1fr}.discount-options{padding-right:0;border-right:0}.discount-detail-panel{min-height:180px;border-top:1px solid #e5eaf0}.discount-modal-card{padding:24px 18px}.discount-modal-header h2{font-size:21px}}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Added discount selection modal and wired the Discount quick action.");
