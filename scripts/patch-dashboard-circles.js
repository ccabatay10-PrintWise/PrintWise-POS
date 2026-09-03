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
const marker = "/* PrintWise circular sales trend v3 */";
if (!css.includes(marker)) {
  css += `\n${marker}
.sales-trend-card{min-width:0}.sales-circles{min-height:250px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:center;gap:8px;padding:18px 0 10px}.sales-circle-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;min-width:0}.sales-circle{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;position:relative;box-shadow:0 5px 16px rgba(15,23,42,.07)}.sales-circle-inner{width:66px;height:66px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center;padding:4px;box-sizing:border-box}.sales-circle-inner strong{font-size:10px;line-height:1.15;color:#273142;overflow:hidden;text-overflow:ellipsis;max-width:58px}.sales-circle-item>b{font-size:10px;color:#667085;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:84px}.sales-circle-item:first-child .sales-circle{box-shadow:0 7px 20px rgba(239,32,25,.15)}
@media(max-width:1100px){.sales-circles{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:18px}.sales-circle{width:78px;height:78px}.sales-circle-inner{width:58px;height:58px}}
@media(max-width:700px){.sales-circles{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;min-height:250px}.sales-circle{width:70px;height:70px}.sales-circle-inner{width:52px;height:52px}.sales-circle-inner strong{font-size:9px}.sales-circle-item>b{font-size:9px;max-width:72px}}
@media(max-width:430px){.sales-circles{grid-template-columns:repeat(2,minmax(0,1fr));min-height:330px}.sales-circle{width:78px;height:78px}.sales-circle-inner{width:58px;height:58px}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}
console.log("PrintWise: Dashboard sales trend is now presented as circular charts.");
