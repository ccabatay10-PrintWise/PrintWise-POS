const fs = require("fs");
const path = require("path");

const root = process.cwd();
const tsxPath = path.join(root, "app", "dashboard", "page.tsx");
const cssPath = path.join(root, "app", "dashboard", "dashboard.css");

let tsx = fs.readFileSync(tsxPath, "utf8");

// Remove the old Sales Trend / Order Health row completely.
const analyticsStart = tsx.indexOf('        <div className="dashboard-analytics-grid">');
const analyticsEnd = tsx.indexOf('        <div className="dashboard-main-grid">', analyticsStart);
if (analyticsStart >= 0 && analyticsEnd > analyticsStart) {
  tsx = tsx.slice(0, analyticsStart) + tsx.slice(analyticsEnd);
}

// Replace the old command-center hero with the compact approved header.
const heroStart = tsx.indexOf('        <header className="dashboard-header dashboard-hero">');
const periodStart = tsx.indexOf('        <div className="dashboard-period-bar">');
if (heroStart >= 0 && periodStart > heroStart) {
  tsx = tsx.slice(0, heroStart) + tsx.slice(periodStart);
}

if (!tsx.includes('className="dashboard-reference-header"')) {
  const insertAt = tsx.indexOf('        <div className="dashboard-period-bar">');
  if (insertAt < 0) throw new Error("PrintWise: Dashboard period bar not found.");
  const header = `        <header className="dashboard-reference-header">
          <div><h1>Dashboard</h1></div>
          <div className="dashboard-reference-actions">
            <button className="dashboard-date-pill" type="button"><CalendarDays size={16} /> {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} <span>⌄</span></button>
            <button className="dashboard-refresh-icon" onClick={loadDashboard} disabled={loading} title="Refresh dashboard"><RefreshCw size={18} className={loading ? "spin" : ""} /></button>
          </div>
        </header>

`;
  tsx = tsx.slice(0, insertAt) + header + tsx.slice(insertAt);
}

// Add accurate today-only values to the dashboard state.
if (!tsx.includes("todayPayments: number;")) {
  tsx = tsx.replace("  periodSales: number;\n", "  periodSales: number;\n  todayPayments: number;\n  todayOrders: number;\n");
  tsx = tsx.replace("  periodSales: 0,\n", "  periodSales: 0,\n  todayPayments: 0,\n  todayOrders: 0,\n");
  tsx = tsx.replace(
    "      const completedAll = orders.filter((order) => order.status === \"completed\");",
    "      const todayStart = startOfLocalDay(now);\n      const todayOrdersList = orders.filter((order) => {\n        const created = new Date(order.created_at);\n        return !Number.isNaN(created.getTime()) && created >= todayStart && created <= now;\n      });\n      const todayPayments = todayOrdersList.reduce((sum, order) => sum + Number(order.amount_paid || 0), 0);\n      const todayOrders = todayOrdersList.length;\n\n      const completedAll = orders.filter((order) => order.status === \"completed\");",
  );
  tsx = tsx.replace(
    "        periodSales,\n        completedOrders: completedPeriod.length,",
    "        periodSales,\n        todayPayments,\n        todayOrders,\n        completedOrders: completedPeriod.length,",
  );
}

// Replace the old Recent Transactions / Inventory Alerts / quick-action area with
// the approved Today’s Summary, Sales and Expenses, Top Selling, and Low Stock layout.
const mainStart = tsx.indexOf('        <div className="dashboard-main-grid">');
const workspaceEnd = tsx.indexOf('      </section>\n    </main>', mainStart);
if (mainStart < 0 || workspaceEnd <= mainStart) {
  throw new Error("PrintWise: Dashboard main content boundary not found.");
}

const approvedMain = `        <div className="dashboard-reference-grid">
          <section className="dashboard-card today-summary-card">
            <div className="card-title reference-card-title">
              <div>
                <h2>Today's Summary</h2>
                <p>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              <button className="reference-select" type="button">Espacio <span>⌄</span></button>
            </div>

            <div className="today-summary-metrics">
              <div className="summary-metric"><div className="summary-icon blue"><Banknote size={22} /></div><div><span>Payments Received</span><strong>{currency(data.todayPayments)}</strong><small>—</small></div></div>
              <div className="summary-metric"><div className="summary-icon blue"><span className="percent-symbol">%</span></div><div><span>Discounts</span><strong>₱0.00</strong><small>—</small></div></div>
              <div className="summary-metric"><div className="summary-icon blue"><CreditCard size={21} /></div><div><span>Expenses</span><strong>₱0.00</strong><small>—</small></div></div>
              <div className="summary-metric"><div className="summary-icon blue"><ShoppingCart size={21} /></div><div><span>Orders</span><strong>{data.todayOrders}</strong><small>—</small></div></div>
            </div>

            <div className="last-order-panel">
              <div>Last order: <b>{data.recentOrders[0]?.order_no || "-"}</b></div>
              <div>Created by: <b>{data.recentOrders[0]?.customer_name || "-"}</b></div>
              <div>Amount: <b>{data.recentOrders[0] ? currency(data.recentOrders[0].total) : "-"}</b></div>
            </div>

            <a className="reference-report-button" href="/reports">Sales Report <ArrowRight size={16} /></a>
          </section>

          <section className="dashboard-card sales-expenses-card">
            <div className="card-title reference-card-title">
              <div>
                <h2>Sales and Expenses</h2>
                <p>{new Date().toLocaleDateString(undefined, { month: "short" })} 01 - {new Date().toLocaleDateString(undefined, { month: "short" })} {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}</p>
              </div>
              <button className="reference-select" type="button"><CalendarDays size={16} /> Month <span>⌄</span></button>
            </div>

            <div className="donut-pair">
              <div className="donut-item">
                <div className="donut sales-donut"><div><strong>{currency(data.periodSales)}</strong><span>Gross Sales</span></div></div>
                <div className="donut-legend"><i className="legend-sales" /> Espacio</div>
              </div>
              <div className="donut-item">
                <div className="donut expense-donut"><div><strong>₱0.00</strong><span>Expenses</span></div></div>
                <div className="donut-legend"><i className="legend-expense" /> Espacio</div>
              </div>
            </div>

            <a className="reference-report-button" href="/reports">Financial Summary <ArrowRight size={16} /></a>
          </section>

          <section className="dashboard-card table-card">
            <div className="card-title reference-card-title">
              <div><h2>Top Selling Products By Amount</h2><p>{new Date().toLocaleDateString(undefined, { month: "short" })} 01 - {new Date().toLocaleDateString(undefined, { month: "short" })} {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}</p></div>
              <button className="reference-select" type="button"><CalendarDays size={16} /> Month <span>⌄</span></button>
            </div>
            <div className="reference-table">
              <div className="reference-table-head"><span>Image</span><span>Name</span><span>Amount</span></div>
              {data.recentOrders.slice(0, 3).map((order) => (
                <div className="reference-table-row" key={order.id}><span className="product-thumb"><Boxes size={17} /></span><b>{order.order_no}</b><strong>{currency(order.total)}</strong></div>
              ))}
              {data.recentOrders.length === 0 && <div className="dashboard-empty">No completed product sales yet.</div>}
            </div>
            <a className="reference-report-button" href="/products">Catalog Report <ArrowRight size={16} /></a>
          </section>

          <section className="dashboard-card table-card">
            <div className="card-title reference-card-title">
              <div><h2>Low Stock Items</h2><p>Top 5 inventory items that are low or out of stock</p></div>
            </div>
            <div className="reference-table">
              <div className="reference-table-head"><span>Image</span><span>Name</span><span>Stock</span></div>
              {data.lowStock.slice(0, 5).map((item) => (
                <div className="reference-table-row" key={item.id}><span className="product-thumb"><Boxes size={17} /></span><b>{item.name}</b><strong className="stock-alert">{item.quantity}{item.unit || "pcs"}</strong></div>
              ))}
              {data.lowStock.length === 0 && <div className="dashboard-empty">No low-stock items.</div>}
            </div>
            <a className="reference-report-button" href="/inventory">Inventory Report <ArrowRight size={16} /></a>
          </section>
        </div>
`;

tsx = tsx.slice(0, mainStart) + approvedMain + tsx.slice(workspaceEnd);
fs.writeFileSync(tsxPath, tsx, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise approved final dashboard layout v3 */";
if (!css.includes(marker)) {
  css += `
${marker}
.dashboard-workspace{background:#f5f7f9;min-height:100vh}.dashboard-reference-header{height:72px;background:#fff;border-bottom:1px solid #e7ebef;display:flex;align-items:center;justify-content:space-between;padding:0 24px;box-sizing:border-box}.dashboard-reference-header h1{margin:0;font-size:27px;letter-spacing:-.5px;color:#101828}.dashboard-reference-actions{display:flex;align-items:center;gap:10px}.dashboard-date-pill,.dashboard-refresh-icon{height:40px;border:1px solid #dfe4ea;background:#fff;border-radius:10px;color:#344054;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800}.dashboard-date-pill{padding:0 13px}.dashboard-date-pill span{color:#98a2b3;font-size:15px}.dashboard-refresh-icon{width:40px;cursor:pointer}.dashboard-refresh-icon:disabled{opacity:.6}.dashboard-period-bar{margin:0;padding:10px 16px;border-radius:0;border-left:0;border-right:0;border-top:0;min-height:42px}.dashboard-period-bar>div:first-child{gap:8px}.period-label{font-size:10px}.dashboard-period-bar strong{font-size:12px}.period-tabs{background:#f4f6f8;border-radius:9px;padding:2px}.period-tabs button{height:30px;padding:0 11px;font-size:10px}.dashboard-stats{padding:12px 24px;gap:10px}.dash-stat{min-width:0;border-radius:12px;padding:13px;gap:10px;box-shadow:0 3px 12px rgba(15,23,42,.035)}.dash-stat.primary-stat{background:#fff;border-color:#ffd6d3}.dash-stat span{font-size:10px;margin-bottom:4px}.dash-stat strong{font-size:19px}.dash-stat small{font-size:9px;margin-top:5px}.stat-icon{width:36px;height:36px;border-radius:10px}.stat-icon svg{width:18px;height:18px}.dashboard-reference-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:0 24px 20px}.dashboard-card{border-radius:12px;padding:15px;box-shadow:0 3px 12px rgba(15,23,42,.025);background:#fff;border:1px solid #e7ebef}.reference-card-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:10px}.reference-card-title h2{font-size:15px;margin:0}.reference-card-title p{font-size:10px;margin:4px 0 0;color:#667085}.reference-select{height:38px;border:1px solid #dfe4ea;background:#fff;border-radius:9px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;font-weight:700;color:#101828;white-space:nowrap}.reference-select span{color:#98a2b3}.today-summary-card,.sales-expenses-card{min-height:355px}.today-summary-metrics{display:grid;grid-template-columns:1fr 1fr;gap:22px 32px;padding:18px 0}.summary-metric{display:flex;align-items:center;gap:10px}.summary-icon{width:42px;height:42px;border-radius:11px;background:#e4f4ff;display:grid;place-items:center;color:#008ff0;flex:0 0 auto}.percent-symbol{font-size:25px;line-height:1}.summary-metric>div:last-child{display:flex;flex-direction:column}.summary-metric span{font-size:10px;color:#7790b1}.summary-metric strong{font-size:19px;line-height:1.25;color:#111827}.summary-metric small{font-size:12px;color:#98a2b3}.last-order-panel{background:#f8fafc;border-radius:9px;padding:14px;margin-top:2px;color:#3b5b85;font-size:12px;line-height:1.8}.last-order-panel b{font-weight:500}.reference-report-button{margin-top:14px;height:36px;padding:0 12px;border:1px solid #dfe4ea;border-radius:9px;background:#fff;display:inline-flex;align-items:center;gap:8px;color:#101828;text-decoration:none;font-size:12px;font-weight:700}.donut-pair{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:22px;min-height:240px}.donut-item{display:flex;flex-direction:column;align-items:center;gap:12px}.donut{width:156px;height:156px;border-radius:50%;display:grid;place-items:center}.donut>div{width:112px;height:112px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.sales-donut{background:conic-gradient(#00e6ae 0 100%,#dffcf5 100%)}.expense-donut{background:conic-gradient(#ff5065 0 100%,#ffe5e8 100%)}.donut strong{font-size:15px;color:#111827}.donut span{font-size:10px;color:#667085;margin-top:3px}.donut-legend{font-size:11px;font-weight:700;color:#101828;display:flex;align-items:center;gap:7px}.donut-legend i{width:10px;height:10px;border-radius:2px;display:block}.legend-sales{background:#00e6ae}.legend-expense{background:#ff5065}.table-card{min-height:275px}.reference-table{margin-top:4px}.reference-table-head,.reference-table-row{display:grid;grid-template-columns:64px minmax(0,1fr) 100px;align-items:center;gap:8px}.reference-table-head{padding:7px 8px;border-bottom:1px solid #e7ebef;color:#667085;font-size:10px;font-weight:700}.reference-table-head span:last-child{text-align:right}.reference-table-row{min-height:44px;padding:4px 8px;border-bottom:1px solid #eef1f4;font-size:11px}.reference-table-row>strong{text-align:right}.product-thumb{width:32px;height:32px;border-radius:7px;background:#f3f5f7;display:grid;place-items:center;color:#475467}.stock-alert{color:#ff263b}.dashboard-empty{padding:18px 8px;color:#98a2b3;font-size:11px}.quick-dashboard-actions{display:none}@media(max-width:900px){.dashboard-reference-grid{grid-template-columns:1fr}.dashboard-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.dashboard-reference-header{height:62px;padding:0 14px}.dashboard-reference-header h1{font-size:22px}.dashboard-date-pill{display:none}.dashboard-stats{padding:10px 14px;gap:7px}.dash-stat{padding:10px}.dash-stat strong{font-size:16px}.dash-stat small{display:none}.stat-icon{width:32px;height:32px}.dashboard-reference-grid{padding:0 14px 14px;gap:8px}.today-summary-metrics{gap:16px 12px}.donut{width:120px;height:120px}.donut>div{width:86px;height:86px}.donut strong{font-size:12px}.reference-card-title h2{font-size:14px}.reference-select{height:34px;font-size:10px}.reference-table-head,.reference-table-row{grid-template-columns:48px minmax(0,1fr) 78px}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied approved dashboard interface v3; removed Sales Trend and Order Health.");
