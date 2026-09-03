const fs = require("fs");
const path = require("path");

const root = process.cwd();
const tsxPath = path.join(root, "app", "dashboard", "page.tsx");
const cssPath = path.join(root, "app", "dashboard", "dashboard.css");

let tsx = fs.readFileSync(tsxPath, "utf8");

// The approved dashboard does NOT use the Sales Trend / Order Health row.
// Remove that entire analytics row after any earlier dashboard transformations.
const analyticsStart = tsx.indexOf('        <div className="dashboard-analytics-grid">');
const analyticsEnd = tsx.indexOf('        <div className="dashboard-main-grid">', analyticsStart);
if (analyticsStart < 0 || analyticsEnd <= analyticsStart) {
  throw new Error("PrintWise: Approved dashboard analytics row not found.");
}
tsx = tsx.slice(0, analyticsStart) + tsx.slice(analyticsEnd);

// Remove the old greeting/command-center hero. The approved layout uses a
// compact Dashboard header with date and refresh controls instead.
const heroStart = tsx.indexOf('        <header className="dashboard-header dashboard-hero">');
const periodStart = tsx.indexOf('        <div className="dashboard-period-bar">');
if (heroStart >= 0 && periodStart > heroStart) {
  tsx = tsx.slice(0, heroStart) + tsx.slice(periodStart);
}

// Add the approved compact Dashboard header exactly once.
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

fs.writeFileSync(tsxPath, tsx, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise approved final dashboard layout */";
if (!css.includes(marker)) {
  css += `
${marker}
.dashboard-workspace{background:#f5f7f9;min-height:100vh}.dashboard-reference-header{height:72px;background:#fff;border-bottom:1px solid #e7ebef;display:flex;align-items:center;justify-content:space-between;padding:0 24px;box-sizing:border-box}.dashboard-reference-header h1{margin:0;font-size:27px;letter-spacing:-.5px;color:#101828}.dashboard-reference-actions{display:flex;align-items:center;gap:10px}.dashboard-date-pill,.dashboard-refresh-icon{height:40px;border:1px solid #dfe4ea;background:#fff;border-radius:10px;color:#344054;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800}.dashboard-date-pill{padding:0 13px}.dashboard-date-pill span{color:#98a2b3;font-size:15px}.dashboard-refresh-icon{width:40px;cursor:pointer}.dashboard-refresh-icon:disabled{opacity:.6}.dashboard-period-bar{margin:0;padding:10px 16px;border-radius:0;border-left:0;border-right:0;border-top:0;min-height:42px}.dashboard-period-bar>div:first-child{gap:8px}.period-label{font-size:10px}.dashboard-period-bar strong{font-size:12px}.period-tabs{background:#f4f6f8;border-radius:9px;padding:2px}.period-tabs button{height:30px;padding:0 11px;font-size:10px}.dashboard-stats{padding:12px 24px;gap:10px}.dash-stat{min-width:0;border-radius:12px;padding:13px;gap:10px;box-shadow:0 3px 12px rgba(15,23,42,.035)}.dash-stat.primary-stat{background:#fff;border-color:#ffd6d3}.dash-stat span{font-size:10px;margin-bottom:4px}.dash-stat strong{font-size:19px}.dash-stat small{font-size:9px;margin-top:5px}.stat-icon{width:36px;height:36px;border-radius:10px}.stat-icon svg{width:18px;height:18px}.dashboard-main-grid{padding:0 24px 20px;gap:10px}.dashboard-card{border-radius:12px;padding:15px;box-shadow:0 3px 12px rgba(15,23,42,.025)}.card-title{padding-bottom:11px}.card-title h2{font-size:14px}.card-title p{font-size:10px;margin-top:3px}@media(max-width:900px){.dashboard-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.dashboard-reference-header{height:62px;padding:0 14px}.dashboard-reference-header h1{font-size:22px}.dashboard-date-pill{display:none}.dashboard-stats{padding:10px 14px;gap:7px}.dash-stat{padding:10px}.dash-stat strong{font-size:16px}.dash-stat small{display:none}.stat-icon{width:32px;height:32px}.dashboard-main-grid{padding:0 14px 14px}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied approved Dashboard layout; removed Sales Trend and Order Health panels.");
