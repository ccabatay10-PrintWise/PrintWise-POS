const fs=require('fs'),path=require('path');
const root=process.cwd();
const tsxPath=path.join(root,'app','dashboard','page.tsx');
const cssPath=path.join(root,'app','dashboard','dashboard.css');
let tsx=fs.readFileSync(tsxPath,'utf8');
const heroStart=tsx.indexOf('        <header className="dashboard-header dashboard-hero">');
const periodStart=tsx.indexOf('        <div className="dashboard-period-bar">',heroStart);
if(heroStart<0||periodStart<heroStart) throw new Error('Dashboard hero markers not found');
tsx=tsx.slice(0,heroStart)+`        <header className="dashboard-reference-header">
          <div><h1>Dashboard</h1></div>
          <div className="dashboard-reference-actions">
            <button className="dashboard-date-pill" type="button"><CalendarDays size={16}/> {new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} <span>⌄</span></button>
            <button className="dashboard-refresh-icon" onClick={loadDashboard} disabled={loading} title="Refresh dashboard"><RefreshCw size={18} className={loading?'spin':''}/></button>
          </div>
        </header>
`+tsx.slice(periodStart);
const analyticsStart=tsx.indexOf('        <div className="dashboard-analytics-grid">');
const mainStart=tsx.indexOf('        <div className="dashboard-main-grid">',analyticsStart);
if(analyticsStart<0||mainStart<analyticsStart) throw new Error('Dashboard analytics markers not found');
const reference=`        <div className="dashboard-reference-grid">
          <section className="dashboard-card reference-summary-card">
            <div className="reference-card-head">
              <div><h2>Sales Summary</h2><p>{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</p></div>
              <span className="reference-filter">{periodLabel} <span>⌄</span></span>
            </div>
            <div className="reference-summary-metrics">
              <div><span className="reference-metric-icon blue"><Banknote size={19}/></span><div><small>Sales Received</small><strong>{currency(data.periodSales)}</strong></div></div>
              <div><span className="reference-metric-icon blue"><ReceiptText size={19}/></span><div><small>Completed Orders</small><strong>{data.completedOrders}</strong></div></div>
              <div><span className="reference-metric-icon blue"><CircleDollarSign size={19}/></span><div><small>Average Order</small><strong>{currency(data.averageOrder)}</strong></div></div>
              <div><span className="reference-metric-icon blue"><Users size={19}/></span><div><small>Customers</small><strong>{data.customerCount}</strong></div></div>
            </div>
            <div className="reference-last-order">
              <div>Last order: <b>{data.recentOrders[0]?.order_no || '—'}</b></div>
              <div>Customer: <b>{data.recentOrders[0]?.customer_name || '—'}</b></div>
              <div>Amount: <b>{data.recentOrders[0] ? currency(data.recentOrders[0].total) : '—'}</b></div>
            </div>
            <a className="reference-report-btn" href="/orders">Sales Report <ArrowRight size={15}/></a>
          </section>
          <section className="dashboard-card reference-sales-card">
            <div className="reference-card-head">
              <div><h2>Sales Overview</h2><p>{periodLabel}</p></div>
              <span className="reference-filter">{period === '30d' ? '30 Days' : period === 'today' ? 'Today' : '7 Days'} <span>⌄</span></span>
            </div>
            <div className="reference-donuts">
              <div className="reference-donut-wrap"><div className="reference-donut sales-donut"><div><strong>{currency(data.periodSales)}</strong><span>Period Sales</span></div></div><b>Period Sales</b></div>
              <div className="reference-donut-wrap"><div className="reference-donut orders-donut"><div><strong>{data.completedOrders}</strong><span>Completed Orders</span></div></div><b>Orders</b></div>
            </div>
            <a className="reference-report-btn" href="/reports">Financial Summary <ArrowRight size={15}/></a>
          </section>
        </div>

`;
tsx=tsx.slice(0,analyticsStart)+reference+tsx.slice(mainStart);
fs.writeFileSync(tsxPath,tsx,'utf8');
let css=fs.readFileSync(cssPath,'utf8');
css+=`\n/* PrintWise: approved reference POS dashboard interface */
.dashboard-reference-header{height:72px;background:#fff;border-bottom:1px solid #e7ebef;display:flex;align-items:center;justify-content:space-between;padding:0 24px;box-sizing:border-box}.dashboard-reference-header h1{margin:0;font-size:27px;letter-spacing:-.5px;color:#101828}.dashboard-reference-actions{display:flex;align-items:center;gap:10px}.dashboard-date-pill,.dashboard-refresh-icon{height:40px;border:1px solid #dfe4ea;background:#fff;border-radius:10px;color:#344054;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800}.dashboard-date-pill{padding:0 13px}.dashboard-date-pill span{color:#98a2b3;font-size:15px}.dashboard-refresh-icon{width:40px;cursor:pointer}.dashboard-refresh-icon:disabled{opacity:.6}.dashboard-period-bar{margin:0;padding:10px 16px;border-radius:0;border-left:0;border-right:0;border-top:0;min-height:42px}.dashboard-stats{padding:12px 24px;gap:10px}.dash-stat{border-radius:12px;padding:13px;box-shadow:0 3px 12px rgba(15,23,42,.035)}.dash-stat span{font-size:10px}.dash-stat strong{font-size:19px}.dash-stat small{font-size:9px}.stat-icon{width:36px;height:36px;border-radius:10px}.dashboard-reference-grid{padding:0 24px 12px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.reference-summary-card,.reference-sales-card{padding:16px;border-radius:12px}.reference-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #edf0f3;padding-bottom:11px}.reference-card-head h2{margin:0;font-size:15px;color:#101828}.reference-card-head p{margin:3px 0 0;font-size:10px;color:#667085}.reference-filter{height:30px;padding:0 9px;border:1px solid #dfe4ea;border-radius:8px;display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;color:#344054;background:#fff}.reference-filter span{color:#98a2b3}.reference-summary-metrics{display:grid;grid-template-columns:1fr 1fr;gap:18px 28px;padding:18px 4px}.reference-summary-metrics>div{display:flex;align-items:center;gap:9px}.reference-metric-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center}.reference-metric-icon.blue{background:#e9f6ff;color:#0088e8}.reference-summary-metrics small,.reference-summary-metrics strong{display:block}.reference-summary-metrics small{font-size:10px;color:#7a8695}.reference-summary-metrics strong{font-size:16px;color:#101828;margin-top:2px}.reference-last-order{background:#f7f9fb;border-radius:10px;padding:10px 12px;color:#667085;font-size:10px;line-height:1.8}.reference-last-order b{color:#344054}.reference-report-btn{margin-top:10px;display:inline-flex;align-items:center;gap:6px;border:1px solid #dfe4ea;background:#fff;border-radius:8px;padding:7px 10px;color:#101828;text-decoration:none;font-size:10px;font-weight:800}.reference-report-btn:hover{border-color:#ef2019;color:#ef2019}.reference-donuts{display:flex;align-items:center;justify-content:space-around;gap:20px;padding:18px 4px 10px;min-height:235px}.reference-donut-wrap{display:flex;flex-direction:column;align-items:center;gap:8px}.reference-donut{width:130px;height:130px;border-radius:50%;display:grid;place-items:center}.reference-donut>div{width:96px;height:96px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.sales-donut{background:conic-gradient(#12d9ad 0 82%,#eaf0f2 82% 100%)}.orders-donut{background:conic-gradient(#ff5062 0 68%,#eaf0f2 68% 100%)}.reference-donut strong{font-size:14px;color:#101828}.reference-donut span{font-size:9px;color:#667085;margin-top:3px}.reference-donut-wrap>b{font-size:10px;color:#344054}.dashboard-main-grid{padding:0 24px 18px;gap:10px}.dashboard-card{border-radius:12px;padding:16px}.dashboard-bottom-grid{padding:0 24px 24px;gap:10px}.staff-section{margin-left:24px;margin-right:24px}@media(max-width:900px){.dashboard-reference-grid{grid-template-columns:1fr}.dashboard-reference-header{padding:0 14px}.dashboard-stats{padding:10px 14px}.dashboard-main-grid,.dashboard-bottom-grid{padding-left:14px;padding-right:14px}}@media(max-width:600px){.dashboard-reference-header{height:62px}.dashboard-reference-header h1{font-size:22px}.dashboard-date-pill{display:none}.dashboard-stats{grid-template-columns:1fr 1fr}.reference-donuts{min-height:200px}.reference-donut{width:105px;height:105px}.reference-donut>div{width:78px;height:78px}.reference-donut strong{font-size:11px}.reference-summary-metrics{gap:13px 12px}.reference-summary-metrics strong{font-size:14px}}\n`;
fs.writeFileSync(cssPath,css,'utf8');
console.log('PrintWise: Applied approved reference POS dashboard interface.');
