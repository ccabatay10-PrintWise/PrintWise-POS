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
const orderHealthStart=tsx.indexOf('          <section className="dashboard-card order-health-card">',analyticsStart);
const analyticsEnd=tsx.indexOf('        </div>',orderHealthStart);
if(analyticsStart<0||orderHealthStart<analyticsStart||analyticsEnd<orderHealthStart) throw new Error('Dashboard analytics markers not found');
const trendSection=`          <section className="dashboard-card sales-trend-card">
            <div className="card-title">
              <div><h2>Sales Trend</h2><p>Completed sales for {periodLabel.toLowerCase()}.</p></div>
              <span className="card-chip"><TrendingUp size={14}/> {currency(data.periodSales)}</span>
            </div>
            <div className="sales-circle-row">
              {data.trend.map((item)=>{
                const percent=Math.max(0,Math.min(100,maxTrend>0?(item.amount/maxTrend)*100:0));
                return <div className="sales-circle-item" key={item.key}>
                  <div className="sales-circle" style={{background:`conic-gradient(#ff1111 0 ${percent}%,#edf1f5 ${percent}% 100%)`}}>
                    <div><strong>{item.amount>0?currency(item.amount):'₱0'}</strong></div>
                  </div>
                  <b>{item.label}</b>
                </div>;
              })}
            </div>
          </section>
`;
const orderSection=tsx.slice(orderHealthStart,analyticsEnd);
tsx=tsx.slice(0,analyticsStart)+'        <div className="dashboard-analytics-grid">\n'+trendSection+orderSection+'        </div>'+tsx.slice(analyticsEnd+'        </div>'.length);
fs.writeFileSync(tsxPath,tsx,'utf8');

let css=fs.readFileSync(cssPath,'utf8');
css+=`\n/* PrintWise: approved clean POS dashboard interface */
.dashboard-reference-header{height:72px;background:#fff;border-bottom:1px solid #e7ebef;display:flex;align-items:center;justify-content:space-between;padding:0 24px;box-sizing:border-box}.dashboard-reference-header h1{margin:0;font-size:27px;letter-spacing:-.5px;color:#101828}.dashboard-reference-actions{display:flex;align-items:center;gap:10px}.dashboard-date-pill,.dashboard-refresh-icon{height:40px;border:1px solid #dfe4ea;background:#fff;border-radius:10px;color:#344054;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800}.dashboard-date-pill{padding:0 13px}.dashboard-date-pill span{color:#98a2b3;font-size:15px}.dashboard-refresh-icon{width:40px;cursor:pointer}.dashboard-refresh-icon:disabled{opacity:.6}.dashboard-period-bar{margin:0;padding:10px 16px;border-radius:0;border-left:0;border-right:0;border-top:0;min-height:42px}.dashboard-stats{padding:12px 24px;gap:10px}.dash-stat{border-radius:12px;padding:13px;box-shadow:0 3px 12px rgba(15,23,42,.035)}.dash-stat span{font-size:10px}.dash-stat strong{font-size:19px}.dash-stat small{font-size:9px}.stat-icon{width:36px;height:36px;border-radius:10px}.dashboard-analytics-grid{padding:0 24px 12px;gap:10px}.dashboard-card{border-radius:12px;padding:16px}.sales-circle-row{display:flex;align-items:center;justify-content:space-around;gap:12px;padding:22px 6px 10px;min-height:235px;overflow:hidden}.sales-circle-item{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:82px}.sales-circle{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;box-shadow:0 7px 18px rgba(15,23,42,.06)}.sales-circle>div{width:64px;height:64px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center}.sales-circle strong{font-size:10px;color:#101828}.sales-circle-item>b{font-size:10px;color:#667085}.dashboard-main-grid{padding:0 24px 12px;gap:10px}.dashboard-bottom-grid{padding:0 24px 24px;gap:10px}.staff-section{margin-left:24px;margin-right:24px}@media(max-width:900px){.dashboard-analytics-grid{grid-template-columns:1fr}.dashboard-reference-header{padding:0 14px}.dashboard-stats{padding:10px 14px}.dashboard-main-grid,.dashboard-bottom-grid{padding-left:14px;padding-right:14px}.sales-circle-row{overflow-x:auto;justify-content:flex-start}.sales-circle-item{flex:0 0 82px}}@media(max-width:600px){.dashboard-reference-header{height:62px}.dashboard-reference-header h1{font-size:22px}.dashboard-date-pill{display:none}.dashboard-stats{grid-template-columns:1fr 1fr}.sales-circle-row{min-height:190px}.sales-circle{width:76px;height:76px}.sales-circle>div{width:55px;height:55px}.sales-circle strong{font-size:9px}}\n`;
fs.writeFileSync(cssPath,css,'utf8');
console.log('PrintWise: Applied approved reference POS dashboard interface.');
