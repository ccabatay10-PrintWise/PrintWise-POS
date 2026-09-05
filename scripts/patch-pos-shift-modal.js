const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
const pageMarker = "/* PrintWise POS Shift Reading modal */";
const cssMarker = "/* PrintWise POS Shift Reading modal styles */";

let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!page.includes(pageMarker)) {
  const stateNeedle = '  const [handoffLoaded, setHandoffLoaded] = useState(false);';
  if (!page.includes(stateNeedle)) throw new Error("POS state marker not found; cannot add Shift popup.");
  page = page.replace(stateNeedle, `${stateNeedle}\n  const [shiftModalOpen, setShiftModalOpen] = useState(false);\n  const [shiftReadingTab, setShiftReadingTab] = useState("Details");\n  const [shiftExpenseTab, setShiftExpenseTab] = useState("Add Expenses");\n  const [shiftInventoryTab, setShiftInventoryTab] = useState("Products Sold");\n  const [shiftExpenseName, setShiftExpenseName] = useState("");\n  const [shiftExpenseAmount, setShiftExpenseAmount] = useState("");\n\n  ${pageMarker}\n  useEffect(() => {\n    document.body.classList.toggle("printwise-shift-open", shiftModalOpen);\n    return () => document.body.classList.remove("printwise-shift-open");\n  }, [shiftModalOpen]);`);
}

page = page.replace(
  'className="pos-quick-action pos-quick-action-active" title="Shift"',
  'className="pos-quick-action pos-quick-action-active" onClick={() => setShiftModalOpen(true)} title="Shift"'
);

if (!page.includes('className="pw-shift-modal"')) {
  const modal = String.raw`
      {shiftModalOpen && (
        <div className="pw-shift-overlay" role="dialog" aria-modal="true" aria-labelledby="pw-shift-title">
          <div className="pw-shift-modal">
            <div className="pw-shift-header">
              <div className="pw-shift-title"><Clock3 size={27} /><h2 id="pw-shift-title">Shift Reading</h2><span>Espacio · POS #1</span></div>
              <button type="button" className="pw-shift-close" onClick={() => setShiftModalOpen(false)} aria-label="Close shift reading"><X size={22} /></button>
            </div>

            <div className="pw-shift-scroll">
              <div className="pw-shift-kpis">
                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><span>$</span></div><div><small>Payments Received</small><strong>₱672.00</strong></div></div>
                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><ShoppingCart size={27} /></div><div><small>Total Orders</small><strong>1</strong></div></div>
                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><span>↓</span></div><div><small>Withdrawals</small><strong>₱0.00</strong></div></div>
                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><Banknote size={27} /></div><div><small>Cash in Drawer</small><strong>₱500.00</strong></div></div>
              </div>

              <section className="pw-shift-card">
                <div className="pw-shift-tabs">
                  {['Details','Payments Received','Withdrawals','Cash in Drawer'].map((tab) => <button key={tab} type="button" className={shiftReadingTab === tab ? 'active' : ''} onClick={() => setShiftReadingTab(tab)}>{tab}</button>)}
                </div>
                {shiftReadingTab === 'Details' ? <>
                  <div className="pw-shift-detail-grid">
                    <div><small>Shift Number</small><b>SH000001</b></div><div><small>Business Day</small><b>BD000001</b></div><div><small>Opening Fund</small><b>₱500.00 <span className="pw-shift-pencil">⌕</span></b></div><div><small>Start Time</small><b>Sep 02, 2026, 10:40 AM</b></div>
                  </div>
                  <div className="pw-shift-lines"><div><span>Gross Sales</span><b>₱840.00</b></div><div><span>Discount</span><b>₱168.00</b></div><div><span>Refund</span><b>₱0.00</b></div><div><span>Void</span><b>₱0.00</b></div></div>
                  <div className="pw-shift-reading-actions"><button type="button">Generate X Reading</button><button type="button">Generate Z Reading</button></div>
                </> : <div className="pw-shift-tab-placeholder">{shiftReadingTab} details will appear here.</div>}
              </section>

              <section className="pw-shift-card pw-shift-expenses">
                <div className="pw-shift-tabs">
                  <button type="button" className={shiftExpenseTab === 'Add Expenses' ? 'active' : ''} onClick={() => setShiftExpenseTab('Add Expenses')}>Add Expenses</button>
                  <button type="button" className={shiftExpenseTab === 'Cash Management' ? 'active' : ''} onClick={() => setShiftExpenseTab('Cash Management')}>Cash Management</button>
                </div>
                {shiftExpenseTab === 'Add Expenses' ? <>
                  <div className="pw-shift-form-grid">
                    <label>Category<select><option>Employee Shift</option><option>Supplies</option><option>Utilities</option><option>Other</option></select></label>
                    <label>Payment Method<select><option>Cash</option><option>GCash</option><option>Bank Transfer</option></select></label>
                    <label>Name<input value={shiftExpenseName} onChange={(e) => setShiftExpenseName(e.target.value)} placeholder="Enter expense name" /></label>
                    <label>Amount<input value={shiftExpenseAmount} onChange={(e) => setShiftExpenseAmount(e.target.value)} placeholder="0.00" inputMode="decimal" /></label>
                  </div>
                  <div className="pw-shift-form-actions"><button type="button" className="primary">Add Expense</button><button type="button" onClick={() => { setShiftExpenseName(''); setShiftExpenseAmount(''); }}>Clear</button></div>
                </> : <div className="pw-shift-tab-placeholder">Cash management tools will appear here.</div>}
              </section>

              <section className="pw-shift-card pw-shift-sales">
                <h3>Sales &amp; Inventory</h3>
                <div className="pw-shift-tabs">
                  <button type="button" className={shiftInventoryTab === 'Products Sold' ? 'active' : ''} onClick={() => setShiftInventoryTab('Products Sold')}>Products Sold</button>
                  <button type="button" className={shiftInventoryTab === 'Inventory Used' ? 'active' : ''} onClick={() => setShiftInventoryTab('Inventory Used')}>Inventory Used</button>
                </div>
                <div className="pw-shift-table"><div className="pw-shift-table-head"><span>Product</span><span>Category</span><span>Quantity</span></div>{(shiftInventoryTab === 'Products Sold' ? [['TSHIRT','SHIRTS','1'],['TSHIRT WITH DTF PRINT','SHIRTS','1'],['PLAIN SHIRT','SHIRTS','1']] : [['DTF FILM','PRINTING MATERIALS','1'],['HEAT TRANSFER PAPER','PRINTING MATERIALS','1']]).map((row, i) => <div className="pw-shift-table-row" key={i}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span></div>)}</div>
              </section>
            </div>

            <div className="pw-shift-footer"><button type="button" onClick={() => setShiftModalOpen(false)}>Close</button><button type="button">Open Drawer</button><button type="button" className="end">End Shift</button></div>
          </div>
        </div>
      )}
`;
  const close = page.lastIndexOf("\n    </main>");
  if (close === -1) throw new Error("POS main closing marker not found; cannot add Shift popup.");
  page = page.slice(0, close) + modal + page.slice(close);
}

fs.writeFileSync(pagePath, page, "utf8");

if (!css.includes(cssMarker)) {
  css += String.raw`

${cssMarker}
body.printwise-shift-open .sidebar-compact{filter:blur(7px);opacity:.74;pointer-events:none}
body.printwise-shift-open .sidebar-compact::after{content:"";position:absolute;inset:0;background:rgba(10,15,22,.28);pointer-events:none}
.pw-shift-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.72);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box}
.pw-shift-modal{position:relative;z-index:1;width:min(1120px,calc(100vw - 20px));height:min(804px,calc(100vh - 20px));background:#fff;border:1px solid #d8dee6;border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;color:#182230}
.pw-shift-header{height:70px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 22px 0 30px;border-bottom:1px solid #eef1f4}.pw-shift-title{display:flex;align-items:center;gap:10px}.pw-shift-title svg{color:#30343a}.pw-shift-title h2{margin:0;font-size:24px;font-weight:700}.pw-shift-title span{color:#7a7d87;font-size:17px}.pw-shift-close{width:38px;height:38px;border:0;background:transparent;color:#666b73;border-radius:8px;display:grid;place-items:center}.pw-shift-close:hover{background:#f2f4f7}
.pw-shift-scroll{flex:1;overflow:auto;padding:18px 30px 12px;background:#fff}.pw-shift-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:28px}.pw-shift-kpi{height:96px;border:1px solid #dce1e7;border-radius:17px;box-shadow:0 2px 5px rgba(16,24,40,.08);display:flex;align-items:center;gap:15px;padding:0 20px;box-sizing:border-box}.pw-shift-kpi-icon{width:50px;height:50px;border-radius:13px;background:#eaf7ff;color:#0797e8;display:grid;place-items:center;font-size:29px}.pw-shift-kpi small{display:block;color:#405773;font-size:15px;margin-bottom:5px}.pw-shift-kpi strong{display:block;color:#101828;font-size:24px;line-height:1;font-weight:700}.pw-shift-card{border:1px solid #dce1e7;border-radius:17px;box-shadow:0 2px 5px rgba(16,24,40,.07);padding:16px 30px 0;margin-bottom:18px;background:#fff}.pw-shift-tabs{height:50px;border-radius:10px;background:#f3f3f5;padding:4px;display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:28px}.pw-shift-tabs button{border:0;background:transparent;color:#777984;font-size:17px;border-radius:8px;cursor:pointer}.pw-shift-tabs button.active{background:#fff;color:#17191d;box-shadow:0 2px 5px rgba(16,24,40,.13)}.pw-shift-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;margin:0 0 20px}.pw-shift-detail-grid small{display:block;color:#55708f;font-size:17px;margin-bottom:8px}.pw-shift-detail-grid b{display:block;font-size:17px;font-weight:500;color:#17191d}.pw-shift-pencil{color:#5e9ad0}.pw-shift-lines{border-top:0}.pw-shift-lines>div{height:46px;border-bottom:1px solid #e7ebef;display:flex;align-items:center;justify-content:space-between;font-size:17px}.pw-shift-lines span{color:#55708f}.pw-shift-lines b{font-weight:500}.pw-shift-reading-actions{border-top:1px solid #e7ebef;margin-top:30px;padding:18px 0 20px;display:flex;gap:10px}.pw-shift-reading-actions button,.pw-shift-form-actions button,.pw-shift-footer button{height:41px;padding:0 15px;border:1px solid #d7dce3;border-radius:9px;background:#fff;color:#20242a;font-size:16px}.pw-shift-tab-placeholder{padding:30px 0;color:#7b8088}.pw-shift-expenses{padding-bottom:22px}.pw-shift-expenses .pw-shift-tabs{grid-template-columns:1fr 1fr;margin-bottom:30px}.pw-shift-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.pw-shift-form-grid label{display:flex;flex-direction:column;gap:10px;color:#344b69;font-size:17px;font-weight:600}.pw-shift-form-grid input,.pw-shift-form-grid select{height:45px;border:1px solid #dce1e7;border-radius:10px;padding:0 14px;font-size:17px;background:#fff;color:#20242a;outline:0;box-sizing:border-box}.pw-shift-form-grid input:focus,.pw-shift-form-grid select:focus{border-color:#9cb7d2}.pw-shift-form-actions{display:flex;gap:10px;margin-top:20px}.pw-shift-form-actions .primary{background:#68bdf0;border-color:#68bdf0;color:#fff;font-weight:700}.pw-shift-sales{padding-bottom:18px}.pw-shift-sales h3{margin:0 0 18px;font-size:20px}.pw-shift-sales .pw-shift-tabs{grid-template-columns:1fr 1fr;margin-bottom:20px}.pw-shift-table-head,.pw-shift-table-row{display:grid;grid-template-columns:1.4fr .8fr .6fr;align-items:center;min-height:46px;border-bottom:1px solid #dce1e7;font-size:17px}.pw-shift-table-head{color:#707584;font-weight:600}.pw-shift-table-row:nth-child(even){background:#fafafa}.pw-shift-table-row span,.pw-shift-table-head span{padding:0 10px}.pw-shift-footer{height:64px;flex:none;display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:0 30px;border-top:1px solid #eef1f4;background:#fff}.pw-shift-footer button{min-width:90px}.pw-shift-footer .end{background:#ff0808;border-color:#ff0808;color:#fff;font-weight:700;min-width:115px}
@media(max-width:800px){.pw-shift-overlay{padding:0}.pw-shift-modal{width:100vw;height:100vh;border-radius:0}.pw-shift-scroll{padding:15px}.pw-shift-kpis{grid-template-columns:1fr 1fr;gap:10px}.pw-shift-card{padding:14px 16px 0}.pw-shift-detail-grid{grid-template-columns:1fr 1fr}.pw-shift-title h2{font-size:20px}.pw-shift-title span{font-size:13px}.pw-shift-footer{padding:0 15px}.pw-shift-kpi strong{font-size:20px}.pw-shift-kpi small{font-size:13px}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Added Shift Reading popup matching the supplied reference interface.");
