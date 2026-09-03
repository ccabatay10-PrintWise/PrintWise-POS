const fs = require("fs");
const path = require("path");
const root = process.cwd();
const tsxPath = path.join(root, "app", "dashboard", "page.tsx");
const cssPath = path.join(root, "app", "dashboard", "dashboard.css");

let tsx = fs.readFileSync(tsxPath, "utf8");
const startMarker = '            <div className="sales-bars">';
const endMarker = '          </section>\n\n          <section className="dashboard-card order-health-card">';
const start = tsx.indexOf(startMarker);
const end = tsx.indexOf(endMarker, start);

if (start >= 0 && end > start) {
  const replacement = `            <div className="sales-circles">
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
  tsx = tsx.slice(0, start) + replacement + tsx.slice(end);
  fs.writeFileSync(tsxPath, tsx, "utf8");
}

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise circular sales trend */";
if (!css.includes(marker)) {
  css += `\n${marker}
.sales-trend-card{min-width:0}.sales-circles{min-height:245px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:center;gap:12px;padding:20px 4px 8px}.sales-circle-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-width:0}.sales-circle{width:78px;height:78px;border-radius:50%;display:grid;place-items:center;position:relative;box-shadow:0 4px 12px rgba(15,23,42,.06)}.sales-circle-inner{width:58px;height:58px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center;padding:4px;box-sizing:border-box}.sales-circle-inner strong{font-size:10px;line-height:1.1;color:#273142;overflow:hidden;text-overflow:ellipsis;max-width:52px}.sales-circle-item>b{font-size:10px;color:#667085;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px}.sales-circle-item:first-child .sales-circle{box-shadow:0 6px 18px rgba(239,32,25,.13)}
@media(max-width:900px){.sales-circles{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:16px}.sales-circle{width:72px;height:72px}.sales-circle-inner{width:54px;height:54px}}
@media(max-width:600px){.sales-circles{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 0 4px;min-height:190px}.sales-circle{width:58px;height:58px}.sales-circle-inner{width:44px;height:44px}.sales-circle-inner strong{font-size:8px}.sales-circle-item>b{font-size:8px;max-width:60px}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}
console.log("PrintWise: Dashboard sales trend converted from bars to circular charts.");
