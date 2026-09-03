const fs=require('fs'),path=require('path');
const root=process.cwd();
const tsxPath=path.join(root,'app','dashboard','page.tsx');
const cssPath=path.join(root,'app','dashboard','dashboard.css');
let tsx=fs.readFileSync(tsxPath,'utf8');

// The earlier dashboard-final patch already removes the old hero and converts
// the Sales Trend to circular indicators. This patch only adds the approved
// reference-style header when it is not already present.
const periodStart=tsx.indexOf('        <div className="dashboard-period-bar">');
if(periodStart<0) throw new Error('Dashboard period bar not found');
if(!tsx.includes('className="dashboard-reference-header"')){
  const header=`        <header className="dashboard-reference-header">
          <div><h1>Dashboard</h1></div>
          <div className="dashboard-reference-actions">
            <button className="dashboard-date-pill" type="button"><CalendarDays size={16}/> {new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} <span>⌄</span></button>
            <button className="dashboard-refresh-icon" onClick={loadDashboard} disabled={loading} title="Refresh dashboard"><RefreshCw size={18} className={loading?'spin':''}/></button>
          </div>
        </header>
`;
  tsx=tsx.slice(0,periodStart)+header+tsx.slice(periodStart);
}
fs.writeFileSync(tsxPath,tsx,'utf8');

let css=fs.readFileSync(cssPath,'utf8');
const marker='/* PrintWise approved reference-style dashboard */';
if(!css.includes(marker)){
css+=`\n${marker}
.dashboard-reference-header{height:72px;background:#fff;border-bottom:1px solid #e7ebef;display:flex;align-items:center;justify-content:space-between;padding:0 24px;box-sizing:border-box}.dashboard-reference-header h1{margin:0;font-size:27px;letter-spacing:-.5px;color:#101828}.dashboard-reference-actions{display:flex;align-items:center;gap:10px}.dashboard-date-pill,.dashboard-refresh-icon{height:40px;border:1px solid #dfe4ea;background:#fff;border-radius:10px;color:#344054;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800}.dashboard-date-pill{padding:0 13px}.dashboard-date-pill span{color:#98a2b3;font-size:15px}.dashboard-refresh-icon{width:40px;cursor:pointer}.dashboard-refresh-icon:disabled{opacity:.6}.dashboard-period-bar{margin:0;padding:10px 16px;border-radius:0;border-left:0;border-right:0;border-top:0;min-height:42px}.dashboard-stats{padding:12px 24px;gap:10px}.dash-stat{border-radius:12px;padding:13px;box-shadow:0 3px 12px rgba(15,23,42,.035)}.dash-stat span{font-size:10px}.dash-stat strong{font-size:19px}.dash-stat small{font-size:9px}.stat-icon{width:36px;height:36px;border-radius:10px}.dashboard-analytics-grid{padding:0 24px 12px;gap:10px}.dashboard-card{border-radius:12px;padding:16px}.sales-circles{min-height:235px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:center;gap:8px;padding:14px 0 8px}.sales-circle-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-width:0}.sales-circle{width:78px;height:78px;border-radius:50%;display:grid;place-items:center;position:relative;box-shadow:0 5px 15px rgba(15,23,42,.06)}.sales-circle-inner{width:58px;height:58px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center;padding:3px;box-sizing:border-box}.sales-circle-inner strong{font-size:10px;line-height:1.1;color:#273142;max-width:52px;overflow:hidden;text-overflow:ellipsis}.sales-circle-item>b{font-size:9px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:78px}@media(max-width:1100px){.sales-circles{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:18px}}@media(max-width:600px){.dashboard-reference-header{height:62px;padding:0 14px}.dashboard-reference-header h1{font-size:22px}.dashboard-date-pill{display:none}.dashboard-stats{padding:10px 14px;gap:7px}.dash-stat{padding:10px}.dash-stat strong{font-size:16px}.dash-stat small{display:none}.stat-icon{width:32px;height:32px}.dashboard-analytics-grid{padding:0 14px 10px}.sales-circles{grid-template-columns:repeat(3,minmax(0,1fr));min-height:270px;gap:14px}.sales-circle{width:70px;height:70px}.sales-circle-inner{width:52px;height:52px}.sales-circle-inner strong{font-size:9px}.sales-circle-item>b{font-size:9px;max-width:70px}}
`;
fs.writeFileSync(cssPath,css,'utf8');
}
console.log('PrintWise: Applied approved reference-style dashboard interface.');
