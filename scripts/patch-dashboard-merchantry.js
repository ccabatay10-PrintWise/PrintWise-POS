const fs = require("fs");
const path = require("path");

const root = process.cwd();
const tsxPath = path.join(root, "app", "dashboard", "page.tsx");
const cssPath = path.join(root, "app", "dashboard", "dashboard.css");

let tsx = fs.readFileSync(tsxPath, "utf8");

const start = tsx.indexOf('        <div className="dashboard-reference-grid">');
const end = tsx.indexOf('      </section>\n    </main>', start);
if (start < 0 || end <= start) {
  throw new Error("PrintWise: Dashboard reference grid boundary not found.");
}

const merchantryLayout = `        <div className="merchantry-dashboard-grid">
          <section className="dashboard-card financial-summary-card">
            <div className="card-title reference-card-title">
              <div>
                <span className="merchantry-kicker">FINANCIAL SUMMARY</span>
                <h2>Sales Performance</h2>
                <p>{periodLabel} • All PrintWise branches</p>
              </div>
              <a className="financial-report-link" href="/reports">VIEW REPORT <ArrowRight size={14} /></a>
            </div>

            <div className="financial-kpis">
              <div><span>Gross Sales</span><strong>{currency(data.periodSales)}</strong><small>Completed orders</small></div>
              <div><span>Net Sales</span><strong>{currency(data.periodSales)}</strong><small>After recorded discounts</small></div>
              <div><span>Gross Profit</span><strong>{currency(data.periodSales)}</strong><small>COGS not yet recorded</small></div>
              <div><span>Expenses</span><strong>₱0.00</strong><small>Recorded expenses</small></div>
              <div className="financial-kpi-emphasis"><span>Net Profit</span><strong>{currency(data.periodSales)}</strong><small>Sales less recorded expenses</small></div>
            </div>

            <div className="financial-divider" />

            <div className="sales-performance-head">
              <div><b>Sales Trend</b><span>Daily completed sales</span></div>
              <strong>{currency(data.periodSales)}</strong>
            </div>
            <div className="merchantry-chart">
              <div className="chart-grid-lines"><i /><i /><i /><i /></div>
              {data.trend.map((item) => (
                <div className="chart-column" key={item.key}>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ height: `${Math.max((item.amount / maxTrend) * 100, item.amount > 0 ? 8 : 2)}%` }} title={currency(item.amount)} />
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-card today-summary-card merchantry-side-card">
            <div className="card-title reference-card-title">
              <div>
                <span className="merchantry-kicker">TODAY</span>
                <h2>Today's Summary</h2>
                <p>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              <button className="reference-select" type="button">All Branches <span>⌄</span></button>
            </div>

            <div className="today-summary-metrics compact-summary-metrics">
              <div className="summary-metric"><div className="summary-icon blue"><Banknote size={20} /></div><div><span>Payments Received</span><strong>{currency(data.todayPayments)}</strong></div></div>
              <div className="summary-metric"><div className="summary-icon blue"><ShoppingCart size={20} /></div><div><span>Orders</span><strong>{data.todayOrders}</strong></div></div>
              <div className="summary-metric"><div className="summary-icon blue"><CreditCard size={20} /></div><div><span>Expenses</span><strong>₱0.00</strong></div></div>
              <div className="summary-metric"><div className="summary-icon blue"><span className="percent-symbol">%</span></div><div><span>Discounts</span><strong>₱0.00</strong></div></div>
            </div>

            <div className="payment-breakdown">
              <div className="payment-breakdown-head"><b>Payment Overview</b><span>Recorded payments</span></div>
              <div className="payment-progress"><i style={{ width: data.todayPayments > 0 ? "100%" : "0%" }} /></div>
              <div className="payment-total"><span>Total received today</span><strong>{currency(data.todayPayments)}</strong></div>
            </div>

            <div className="last-order-panel">
              <span>Latest Order</span>
              <b>{data.recentOrders[0]?.order_no || "No orders yet"}</b>
              <small>{data.recentOrders[0] ? currency(data.recentOrders[0].total) : "Start selling from POS"}</small>
            </div>

            <a className="reference-report-button" href="/reports">Financial Summary <ArrowRight size={15} /></a>
          </section>

          <section className="dashboard-card table-card merchantry-table-card">
            <div className="card-title reference-card-title">
              <div><span className="merchantry-kicker">PERFORMANCE</span><h2>Top Selling Products</h2><p>Highest-value recent transactions</p></div>
              <a className="financial-report-link" href="/products">VIEW CATALOG <ArrowRight size={14} /></a>
            </div>
            <div className="reference-table merchantry-table">
              <div className="reference-table-head"><span>#</span><span>Transaction</span><span>Amount</span></div>
              {data.recentOrders.slice(0, 5).map((order, index) => (
                <div className="reference-table-row" key={order.id}><span className="rank-number">{index + 1}</span><b>{order.order_no}</b><strong>{currency(order.total)}</strong></div>
              ))}
              {data.recentOrders.length === 0 && <div className="dashboard-empty">No sales data yet.</div>}
            </div>
          </section>

          <section className="dashboard-card table-card merchantry-table-card">
            <div className="card-title reference-card-title">
              <div><span className="merchantry-kicker">INVENTORY</span><h2>Low Stock Items</h2><p>Items requiring attention</p></div>
              <a className="financial-report-link" href="/inventory">VIEW INVENTORY <ArrowRight size={14} /></a>
            </div>
            <div className="reference-table merchantry-table">
              <div className="reference-table-head"><span>!</span><span>Item</span><span>Stock</span></div>
              {data.lowStock.slice(0, 5).map((item) => (
                <div className="reference-table-row" key={item.id}><span className="stock-warning-icon"><AlertTriangle size={14} /></span><b>{item.name}</b><strong className="stock-alert">{item.quantity} {item.unit || "pcs"}</strong></div>
              ))}
              {data.lowStock.length === 0 && <div className="stock-good">All inventory levels are healthy.</div>}
            </div>
          </section>
        </div>
`;

tsx = tsx.slice(0, start) + merchantryLayout + tsx.slice(end);
fs.writeFileSync(tsxPath, tsx, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise Merchantry-inspired dashboard interface */";
if (!css.includes(marker)) {
  css += `
${marker}
.merchantry-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(330px,.9fr);gap:12px;padding:0 24px 24px}.financial-summary-card,.merchantry-side-card,.merchantry-table-card{min-width:0}.financial-summary-card{padding:18px}.merchantry-kicker{display:block;color:#667085;font-size:9px;font-weight:900;letter-spacing:1.1px;margin-bottom:4px}.financial-report-link{display:inline-flex;align-items:center;gap:5px;color:#344054;text-decoration:none;font-size:9px;font-weight:900;white-space:nowrap}.financial-report-link:hover{color:#ef2019}.financial-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;margin-top:18px;border:1px solid #edf0f4;border-radius:10px;overflow:hidden;background:#edf0f4}.financial-kpis>div{background:#fff;padding:12px 11px;min-width:0}.financial-kpis span,.financial-kpis small{display:block;color:#667085}.financial-kpis span{font-size:9px;font-weight:800}.financial-kpis strong{display:block;margin:5px 0 3px;color:#172033;font-size:16px;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.financial-kpis small{font-size:8px;line-height:1.25}.financial-kpi-emphasis{background:#fff9f8!important}.financial-kpi-emphasis strong{color:#ef2019}.financial-divider{height:1px;background:#edf0f4;margin:18px 0 14px}.sales-performance-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.sales-performance-head b,.sales-performance-head span{display:block}.sales-performance-head b{font-size:12px;color:#273142}.sales-performance-head span{font-size:9px;color:#98a2b3;margin-top:3px}.sales-performance-head>strong{font-size:12px;color:#ef2019}.merchantry-chart{height:190px;display:grid;grid-template-columns:repeat(30,minmax(7px,1fr));gap:5px;align-items:end;position:relative;margin-top:12px;padding:10px 4px 0}.chart-grid-lines{position:absolute;inset:10px 4px 27px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none}.chart-grid-lines i{display:block;border-top:1px dashed #e9edf2}.chart-column{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;min-width:0;position:relative;z-index:1}.chart-bar-track{height:150px;width:100%;max-width:18px;display:flex;align-items:flex-end;justify-content:center}.chart-bar-fill{width:100%;background:linear-gradient(to top,#ef2019,#ff817a);border-radius:4px 4px 1px 1px;min-height:2px;transition:height .25s ease}.chart-column span{font-size:7px;color:#98a2b3;white-space:nowrap;overflow:hidden;max-width:28px;text-overflow:ellipsis}.merchantry-side-card{padding:18px}.compact-summary-metrics{grid-template-columns:1fr 1fr;gap:15px 18px;padding:16px 0}.compact-summary-metrics .summary-icon{width:38px;height:38px}.compact-summary-metrics .summary-metric{gap:8px}.compact-summary-metrics .summary-metric span{font-size:8px}.compact-summary-metrics .summary-metric strong{font-size:14px}.payment-breakdown{border-top:1px solid #edf0f4;border-bottom:1px solid #edf0f4;padding:14px 0}.payment-breakdown-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.payment-breakdown-head b{font-size:10px;color:#344054}.payment-breakdown-head span{font-size:8px;color:#98a2b3}.payment-progress{height:8px;border-radius:99px;background:#eef1f4;overflow:hidden;margin:11px 0 8px}.payment-progress i{display:block;height:100%;background:#ef2019;border-radius:inherit}.payment-total{display:flex;align-items:center;justify-content:space-between;gap:10px}.payment-total span{font-size:8px;color:#98a2b3}.payment-total strong{font-size:11px;color:#273142}.last-order-panel{margin-top:12px;padding:11px 12px;border:1px solid #edf0f4;background:#fafbfc;border-radius:9px;display:grid;grid-template-columns:1fr auto;gap:3px 10px}.last-order-panel span{font-size:8px;color:#98a2b3;grid-column:1/-1}.last-order-panel b{font-size:10px;color:#344054;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.last-order-panel small{font-size:9px;color:#667085;text-align:right}.merchantry-table-card{padding:16px}.merchantry-table{margin-top:8px}.merchantry-table .reference-table-head,.merchantry-table .reference-table-row{grid-template-columns:42px minmax(0,1fr) 90px}.merchantry-table .reference-table-head{font-size:8px;text-transform:uppercase;letter-spacing:.5px}.merchantry-table .reference-table-row{min-height:43px;font-size:10px}.merchantry-table .reference-table-row>b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank-number{width:25px;height:25px;border-radius:7px;background:#f4f6f8;display:grid;place-items:center;color:#667085;font-size:9px;font-weight:900}.stock-warning-icon{width:25px;height:25px;border-radius:7px;background:#fff3f0;color:#ef2019;display:grid;place-items:center}.stock-alert{color:#ef2019!important}@media(max-width:1100px){.merchantry-dashboard-grid{grid-template-columns:1fr}.financial-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.merchantry-dashboard-grid{padding:0 14px 16px;gap:8px}.financial-summary-card,.merchantry-side-card,.merchantry-table-card{padding:13px}.financial-kpis{grid-template-columns:1fr 1fr}.financial-kpis>div{padding:10px 9px}.financial-kpis strong{font-size:14px}.merchantry-chart{height:160px;grid-template-columns:repeat(30,minmax(5px,1fr));gap:3px}.chart-bar-track{height:125px;max-width:12px}.chart-column span{font-size:6px}.compact-summary-metrics{gap:12px}.payment-breakdown{padding:12px 0}}@media(max-width:420px){.financial-kpis{grid-template-columns:1fr}.financial-kpis strong{font-size:15px}.merchantry-chart{grid-template-columns:repeat(30,minmax(4px,1fr));gap:2px}.merchantry-table .reference-table-head,.merchantry-table .reference-table-row{grid-template-columns:34px minmax(0,1fr) 76px}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied Merchantry-inspired financial dashboard interface.");
