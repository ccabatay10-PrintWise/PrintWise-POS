const fs = require("fs");
const path = require("path");

const root = process.cwd();
const tsxPath = path.join(root, "app", "dashboard", "page.tsx");
const cssPath = path.join(root, "app", "dashboard", "dashboard.css");

let tsx = fs.readFileSync(tsxPath, "utf8");

// Replace the entire existing trend chart block. This is intentionally anchored
// between Sales Trend and Order Health so no unrelated dashboard content moves.
const trendStart = tsx.indexOf('            <div className="sales-bars">');
const trendEnd = tsx.indexOf('          </section>\n\n          <section className="dashboard-card order-health-card">', trendStart);

if (trendStart < 0 || trendEnd <= trendStart) {
  throw new Error("PrintWise: Could not locate the Dashboard Sales Trend block.");
}

const trendReplacement = `            <div className="sales-circles">
              {data.trend.map((item) => {
                const share = item.amount > 0 ? Math.max(item.amount / maxTrend, 0.08) : 0.02;
                return (
                  <div className="sales-circle-item" key={item.key}>
                    <div
                      className="sales-circle"
                      style={{ background: \`conic-gradient(#ef2019 \${share * 100}%, #edf0f4 0)\` }}
                      title={currency(item.amount)}
                    >
                      <div className="sales-circle-inner">
                        <strong>{item.amount > 0 ? \`₱\${Math.round(item.amount)}\` : "₱0"}</strong>
                      </div>
                    </div>
                    <b>{item.label}</b>
                  </div>
                );
              })}
            </div>
`;

tsx = tsx.slice(0, trendStart) + trendReplacement + tsx.slice(trendEnd);

// Make the top of the dashboard match the approved clean POS interface:
// keep the existing PrintWise data, but use the compact Sales Overview period bar.
const heroStart = tsx.indexOf('        <header className="dashboard-header dashboard-hero">');
const heroEnd = tsx.indexOf('        <div className="dashboard-period-bar">', heroStart);
if (heroStart < 0 || heroEnd <= heroStart) {
  throw new Error("PrintWise: Could not locate the Dashboard hero header.");
}
tsx = tsx.slice(0, heroStart) + tsx.slice(heroEnd);

fs.writeFileSync(tsxPath, tsx, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise approved POS dashboard interface */";
if (!css.includes(marker)) {
  css += `\n${marker}
.dashboard-workspace{background:#f5f7f9;min-height:100vh}.dashboard-period-bar{margin:0;padding:10px 16px;border:1px solid #e4e9ee;border-radius:0;background:#fff;min-height:42px}.dashboard-period-bar>div:first-child{gap:8px}.period-label{font-size:10px}.dashboard-period-bar strong{font-size:12px}.period-tabs{background:#f4f6f8;border-radius:9px;padding:2px}.period-tabs button{height:30px;padding:0 11px;font-size:10px}.dashboard-stats{padding:12px 24px;gap:10px}.dash-stat{min-width:0;border-radius:12px;padding:13px;gap:10px;box-shadow:0 3px 12px rgba(15,23,42,.025)}.dash-stat.primary-stat{background:#fff;border-color:#ffd6d3}.dash-stat span{font-size:10px;margin-bottom:4px}.dash-stat strong{font-size:19px}.dash-stat small{font-size:9px;margin-top:5px}.stat-icon{width:36px;height:36px;border-radius:10px}.stat-icon svg{width:18px;height:18px}.dashboard-analytics-grid{padding:0 24px 10px;gap:10px}.dashboard-card{border-radius:12px;padding:15px;box-shadow:0 3px 12px rgba(15,23,42,.025)}.card-title{padding-bottom:11px}.card-title h2{font-size:14px}.card-title p{font-size:10px;margin-top:3px}.card-chip{padding:5px 7px;font-size:9px}.sales-circles{min-height:235px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:center;gap:8px;padding:14px 0 8px}.sales-circle-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-width:0}.sales-circle{width:78px;height:78px;border-radius:50%;display:grid;place-items:center;position:relative;box-shadow:0 5px 15px rgba(15,23,42,.06)}.sales-circle-inner{width:58px;height:58px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center;padding:3px;box-sizing:border-box}.sales-circle-inner strong{font-size:10px;line-height:1.1;color:#273142;max-width:52px;overflow:hidden;text-overflow:ellipsis}.sales-circle-item>b{font-size:9px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:78px}.sales-circle-item:first-child .sales-circle{box-shadow:0 6px 18px rgba(239,32,25,.13)}
@media(max-width:1100px){.sales-circles{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:18px}.sales-circle{width:76px;height:76px}.sales-circle-inner{width:56px;height:56px}}
@media(max-width:900px){.dashboard-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.sales-circles{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:600px){.dashboard-period-bar{padding:9px 12px}.dashboard-stats{padding:10px 14px;gap:7px}.dash-stat{padding:10px}.dash-stat strong{font-size:16px}.dash-stat small{display:none}.stat-icon{width:32px;height:32px}.dashboard-analytics-grid{padding:0 14px 10px}.sales-circles{grid-template-columns:repeat(3,minmax(0,1fr));min-height:270px;gap:14px}.sales-circle{width:70px;height:70px}.sales-circle-inner{width:52px;height:52px}.sales-circle-inner strong{font-size:9px}.sales-circle-item>b{font-size:9px;max-width:70px}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied approved clean POS dashboard interface and circular sales trend.");
