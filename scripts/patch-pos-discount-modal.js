const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const pageMarker = "/* PRINTWISE_DISCOUNT_MODAL_V2 */";
const cssMarker = "/* PrintWise POS discount selection modal v2 */";

if (!page.includes(pageMarker)) {
  // Add only the icons needed by the discount selector. Avoid duplicate imports.
  const neededIcons = ["UserRound", "Accessibility", "Trophy", "UsersRound", "Percent", "PhilippinePeso"];
  for (const icon of neededIcons) {
    if (!new RegExp(`\\b${icon}\\b`).test(page)) {
      page = page.replace(/\bLayers3\b/, `Layers3, ${icon}`);
    }
  }

  const stateAnchor = 'const [discount, setDiscount] = useState(0);';
  if (!page.includes('const [discountModalOpen, setDiscountModalOpen]')) {
    page = page.replace(stateAnchor, `${stateAnchor}
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState("");
  const [discountRate, setDiscountRate] = useState(20);
  const [discountCustomerName, setDiscountCustomerName] = useState("");
  const [discountIdNumber, setDiscountIdNumber] = useState("");
  const [discountTin, setDiscountTin] = useState("");
  const [childName, setChildName] = useState("");
  const [childBirthDate, setChildBirthDate] = useState("");
  const [childAge, setChildAge] = useState("");
  const [customDiscountValue, setCustomDiscountValue] = useState(0);`);
  }

  const clearAnchor = 'const clearOrder = () => {';
  if (!page.includes('const openDiscountModal = () => {')) {
    page = page.replace(clearAnchor, `const openDiscountModal = () => {
    setSelectedDiscount("");
    setDiscountRate(20);
    setDiscountCustomerName(customer || "");
    setDiscountIdNumber("");
    setDiscountTin("");
    setChildName("");
    setChildBirthDate("");
    setChildAge("");
    setCustomDiscountValue(0);
    setDiscountModalOpen(true);
  };

  const applySelectedDiscount = () => {
    if (!subtotal || !selectedDiscount) return;
    let amount = 0;
    if (selectedDiscount === "Senior" || selectedDiscount === "PWD") {
      amount = subtotal * (discountRate / 100);
    } else if (selectedDiscount === "National Athlete") {
      amount = subtotal * 0.20;
    } else if (selectedDiscount === "Solo Parent") {
      amount = subtotal * 0.10;
    } else if (selectedDiscount === "Percentage") {
      amount = subtotal * (Math.min(100, Math.max(0, customDiscountValue)) / 100);
    } else if (selectedDiscount === "Amount") {
      amount = Math.min(subtotal, Math.max(0, customDiscountValue));
    }
    setCustomer(discountCustomerName.trim());
    setDiscount(Math.max(0, Math.min(subtotal, amount)));
    setDiscountModalOpen(false);
  };

  ${clearAnchor}`);
  }

  // The quick-action rail must open the selector rather than directly changing the amount.
  page = page.replace(
    /<button type="button" className="pos-quick-action" onClick=\{\(\) => setDiscount\(discountAmount\)\} title="Apply discount">/,
    '<button type="button" className="pos-quick-action" onClick={openDiscountModal} title="Apply discount">'
  );

  const modal = `
        {discountModalOpen && <div className="discount-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="discount-modal-title">
          <div className="discount-modal-card">
            <button type="button" className="discount-modal-close" onClick={() => setDiscountModalOpen(false)} aria-label="Close discount window"><X size={21} /></button>
            <div className="discount-modal-header">
              <h2 id="discount-modal-title">Select Discount</h2>
              <p>This will be applied to all line items</p>
            </div>

            <div className="discount-modal-body">
              <div className="discount-options">
                <section className="discount-group">
                  <div className="discount-group-heading">
                    <h3>GOVERNMENT DISCOUNTS</h3>
                    <p>For eligible customers with valid government-issued proof.</p>
                  </div>
                  <div className="discount-card-grid">
                    <button type="button" className={\`discount-option-card \${selectedDiscount === "Senior" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("Senior"); setDiscountRate(20); }}>
                      <span className="discount-option-icon"><UserRound size={22} /></span><b>Senior</b><small>5% or 20% off</small>
                    </button>
                    <button type="button" className={\`discount-option-card \${selectedDiscount === "PWD" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("PWD"); setDiscountRate(20); }}>
                      <span className="discount-option-icon"><Accessibility size={22} /></span><b>PWD</b><small>5% or 20% off</small>
                    </button>
                    <button type="button" className={\`discount-option-card \${selectedDiscount === "National Athlete" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("National Athlete"); setDiscountRate(20); }}>
                      <span className="discount-option-icon"><Trophy size={22} /></span><b>National Athlete</b><small>20% off</small>
                    </button>
                    <button type="button" className={\`discount-option-card \${selectedDiscount === "Solo Parent" ? "selected" : ""}\`} onClick={() => { setSelectedDiscount("Solo Parent"); setDiscountRate(10); }}>
                      <span className="discount-option-icon"><UsersRound size={22} /></span><b>Solo Parent</b><small>10% off</small>
                    </button>
                  </div>
                </section>

                <section className="discount-group">
                  <div className="discount-group-heading">
                    <h3>CUSTOM DISCOUNTS</h3>
                    <p>Manual discount value for promos and discretionary cases.</p>
                  </div>
                  <div className="discount-card-grid custom-grid">
                    <button type="button" className={\`discount-option-card \${selectedDiscount === "Percentage" ? "selected" : ""}\`} onClick={() => setSelectedDiscount("Percentage")}>
                      <span className="discount-option-icon"><Percent size={22} /></span><b>Percentage</b><small>% off item total</small>
                    </button>
                    <button type="button" className={\`discount-option-card \${selectedDiscount === "Amount" ? "selected" : ""}\`} onClick={() => setSelectedDiscount("Amount")}>
                      <span className="discount-option-icon"><PhilippinePeso size={22} /></span><b>Amount</b><small>Fixed peso amount</small>
                    </button>
                  </div>
                </section>
              </div>

              <div className="discount-detail-panel">
                {!selectedDiscount && <div className="discount-empty-detail">Select a discount type to see additional options.</div>}

                {(selectedDiscount === "Senior" || selectedDiscount === "PWD") && <div className="discount-detail-content">
                  <h3>CUSTOMER INFORMATION</h3>
                  <label>Customer Name<input value={discountCustomerName} onChange={(e) => setDiscountCustomerName(e.target.value)} placeholder="Full name as on ID" /></label>
                  <label>{selectedDiscount} ID Number<input value={discountIdNumber} onChange={(e) => setDiscountIdNumber(e.target.value)} placeholder="Enter ID number" /></label>
                  <label>TIN Number <em>(optional)</em><input value={discountTin} onChange={(e) => setDiscountTin(e.target.value)} placeholder="Enter TIN number" /></label>
                  <div className="discount-rate-block"><h4>{selectedDiscount} discount rate</h4><div className="discount-rate-grid"><button type="button" className={discountRate === 5 ? "selected" : ""} onClick={() => setDiscountRate(5)}>5%</button><button type="button" className={discountRate === 20 ? "selected" : ""} onClick={() => setDiscountRate(20)}>20%</button></div></div>
                </div>}

                {selectedDiscount === "National Athlete" && <div className="discount-detail-content">
                  <h3>CUSTOMER INFORMATION</h3>
                  <label>Customer Name<input value={discountCustomerName} onChange={(e) => setDiscountCustomerName(e.target.value)} placeholder="Full name as on ID" /></label>
                  <label>National Athlete ID Number<input value={discountIdNumber} onChange={(e) => setDiscountIdNumber(e.target.value)} placeholder="Enter ID number" /></label>
                </div>}

                {selectedDiscount === "Solo Parent" && <div className="discount-detail-content">
                  <h3>CUSTOMER INFORMATION</h3>
                  <label>Customer Name<input value={discountCustomerName} onChange={(e) => setDiscountCustomerName(e.target.value)} placeholder="Full name as on ID" /></label>
                  <label>Solo Parent ID Number<input value={discountIdNumber} onChange={(e) => setDiscountIdNumber(e.target.value)} placeholder="Enter ID number" /></label>
                  <h3 className="discount-child-heading">CHILD INFORMATION</h3>
                  <label>Child Name<input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Child's full name" /></label>
                  <div className="discount-two-fields"><label>Date of Birth<input type="date" value={childBirthDate} onChange={(e) => setChildBirthDate(e.target.value)} /></label><label>Age<input type="number" min="0" value={childAge} onChange={(e) => setChildAge(e.target.value)} placeholder="Age" /></label></div>
                </div>}

                {selectedDiscount === "Percentage" && <div className="discount-detail-content">
                  <h3>PERCENTAGE DISCOUNT</h3><p>Enter a value between 1 and 100.</p>
                  <label>Enter percentage<div className="discount-input-wrap"><input type="number" min="1" max="100" step="1" value={customDiscountValue || ""} onChange={(e) => setCustomDiscountValue(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} placeholder="Enter percentage" /><span>%</span></div></label>
                </div>}

                {selectedDiscount === "Amount" && <div className="discount-detail-content">
                  <h3>AMOUNT DISCOUNT</h3><p>Enter a fixed peso amount to deduct.</p>
                  <label>Enter amount<div className="discount-input-wrap"><span>₱</span><input type="number" min="0" max={subtotal} step="0.01" value={customDiscountValue || ""} onChange={(e) => setCustomDiscountValue(Math.min(subtotal, Math.max(0, Number(e.target.value) || 0)))} placeholder="Enter amount" /></div></label>
                </div>}
              </div>
            </div>

            <button type="button" className="discount-apply-btn" disabled={!selectedDiscount || !subtotal} onClick={applySelectedDiscount}>Apply Discount</button>
          </div>
        </div>}
${pageMarker}`;

  const paymentMarker = "{paymentModalOpen &&";
  const paymentIndex = page.indexOf(paymentMarker);
  if (paymentIndex === -1) throw new Error("Payment modal insertion anchor not found");
  page = page.slice(0, paymentIndex) + modal + page.slice(paymentIndex);
  fs.writeFileSync(pagePath, page, "utf8");
}

if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.discount-modal-overlay{position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:14px}.discount-modal-card{position:relative;width:min(946px,96vw);max-height:94vh;overflow:auto;background:#fff;border:1px solid #d9e2ec;border-radius:15px;box-shadow:0 24px 70px rgba(15,23,42,.25);padding:28px 30px 30px;color:#172033}.discount-modal-close{position:absolute;right:18px;top:17px;border:0;background:transparent;color:#667085;cursor:pointer;padding:6px;border-radius:8px}.discount-modal-close:hover{background:#f2f4f7}.discount-modal-header h2{margin:0;font-size:23px;font-weight:700;letter-spacing:-.3px}.discount-modal-header p{margin:7px 0 0;color:#667085;font-size:15px}.discount-modal-body{display:grid;grid-template-columns:450px minmax(0,1fr);gap:28px;margin-top:28px}.discount-options{padding-right:28px;border-right:1px solid #e5eaf0}.discount-group+.discount-group{margin-top:20px}.discount-group-heading h3{margin:0;color:#587394;font-size:14px;font-weight:600}.discount-group-heading p{margin:5px 0 14px;color:#5f7795;font-size:13px;line-height:1.4}.discount-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.discount-option-card{min-height:112px;border:1px solid #d9e5ef;border-radius:15px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#2f3742;cursor:pointer;box-shadow:0 2px 4px rgba(16,24,40,.05);transition:.15s ease}.discount-option-card:hover,.discount-option-card.selected{border-color:#0797e6;background:#fff;box-shadow:0 4px 10px rgba(16,24,40,.07);transform:translateY(-1px)}.discount-option-card.selected{color:#0797e6}.discount-option-icon{width:36px;height:36px;border-radius:50%;background:#eef4f8;display:flex;align-items:center;justify-content:center;color:#29343f}.discount-option-card.selected .discount-option-icon{color:#0797e6;background:#edf8fe}.discount-option-card b{font-size:14px;font-weight:500}.discount-option-card small{font-size:12px;color:#587394;font-weight:500}.discount-detail-panel{min-height:390px;display:flex;align-items:flex-start;justify-content:center;color:#87a2bf;font-size:15px;text-align:left;padding:6px 2px}.discount-empty-detail{align-self:center;text-align:center;max-width:300px}.discount-detail-content{width:100%;max-width:388px}.discount-detail-content h3{margin:0 0 12px;color:#587394;font-size:14px;font-weight:600;letter-spacing:.1px}.discount-detail-content p{margin:-5px 0 18px;color:#667085;font-size:13px}.discount-detail-content label{display:block;margin:0 0 14px;color:#304762;font-size:14px;font-weight:600}.discount-detail-content label em{font-style:normal;color:#91a0b2;font-weight:400}.discount-detail-content input{display:block;width:100%;height:49px;margin-top:7px;padding:0 14px;border:1px solid #d9e0e8;border-radius:10px;background:#fff;outline:0;font:inherit;font-weight:400;color:#344054;box-sizing:border-box}.discount-detail-content input:focus{border-color:#79bfe9;box-shadow:0 0 0 3px rgba(11,150,223,.10)}.discount-rate-block{margin-top:8px}.discount-rate-block h4{margin:0 0 9px;color:#304762;font-size:14px;font-weight:600}.discount-rate-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.discount-rate-grid button{height:45px;border:1px solid #d9e0e8;border-radius:9px;background:#fff;color:#344054;font-size:14px;font-weight:600;cursor:pointer}.discount-rate-grid button.selected{border-color:#0797e6;color:#0797e6;background:#f4fbff}.discount-child-heading{margin-top:21px!important}.discount-two-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.discount-input-wrap{height:50px;margin-top:7px;border:1px solid #d9e0e8;border-radius:10px;display:flex;align-items:center;overflow:hidden}.discount-input-wrap:focus-within{border-color:#79bfe9;box-shadow:0 0 0 3px rgba(11,150,223,.10)}.discount-input-wrap span{padding:0 13px;color:#667085;background:#f7f8fa;height:100%;display:flex;align-items:center;font-size:16px}.discount-input-wrap input{border:0;outline:0;width:100%;height:100%;padding:0 12px;font-size:15px;margin:0;box-shadow:none}.discount-input-wrap input:focus{box-shadow:none}.discount-apply-btn{width:100%;height:46px;margin-top:22px;border:0;border-radius:9px;background:#0b96df;color:#fff;font-size:15px;font-weight:700;cursor:pointer}.discount-apply-btn:disabled{opacity:.48;cursor:not-allowed}@media(max-width:800px){.discount-modal-body{grid-template-columns:1fr}.discount-options{padding-right:0;border-right:0}.discount-detail-panel{min-height:220px;border-top:1px solid #e5eaf0;padding-top:20px}.discount-modal-card{padding:24px 18px}.discount-modal-header h2{font-size:21px}}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied discount selector with government customer details, rates, child information, and custom discount inputs.");
