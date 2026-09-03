const fs = require("fs");
const path = require("path");

const root = process.cwd();
const cssPath = path.join(root, "app", "dashboard", "dashboard.css");
const tsxPath = path.join(root, "app", "dashboard", "page.tsx");

let tsx = fs.readFileSync(tsxPath, "utf8");
const pageMarker = "/* PrintWise animated donut SVG */";

if (!tsx.includes(pageMarker)) {
  tsx = tsx.replace(
    '<div className="donut sales-donut"><div><strong>{currency(data.periodSales)}</strong><span>Gross Sales</span></div></div>',
    `<div className="donut sales-donut">
                  <svg className="donut-progress" viewBox="0 0 100 100" aria-hidden="true">
                    <circle className="donut-track" cx="50" cy="50" r="41" />
                    <circle className="donut-fill sales-fill" cx="50" cy="50" r="41" pathLength="100" />
                  </svg>
                  <div><strong>{currency(data.periodSales)}</strong><span>Gross Sales</span></div>
                </div>\n                ${pageMarker}`,
  );
  tsx = tsx.replace(
    '<div className="donut expense-donut"><div><strong>₱0.00</strong><span>Expenses</span></div></div>',
    `<div className="donut expense-donut">
                  <svg className="donut-progress" viewBox="0 0 100 100" aria-hidden="true">
                    <circle className="donut-track" cx="50" cy="50" r="41" />
                    <circle className="donut-fill expense-fill" cx="50" cy="50" r="41" pathLength="100" />
                  </svg>
                  <div><strong>₱0.00</strong><span>Expenses</span></div>
                </div>`,
  );
  fs.writeFileSync(tsxPath, tsx, "utf8");
}

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise reliable donut loading animation v2 */";
if (!css.includes(marker)) {
  css += `

${marker}
/* Keep the approved donut size/interface. Only the ring drawing is animated. */
.donut{position:relative;overflow:visible}
.donut-progress{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;overflow:visible}
.donut-track{fill:none;stroke-width:9;stroke-linecap:butt}
.donut-fill{fill:none;stroke-width:9;stroke-linecap:butt;stroke-dasharray:100;stroke-dashoffset:100;transform:rotate(180deg);transform-origin:50% 50%;animation:pw-donut-draw 2.8s cubic-bezier(.22,.61,.36,1) 0s 1 forwards}
.sales-donut{background:#dffcf5!important}
.expense-donut{background:#ffe5e8!important}
.sales-donut .donut-track{stroke:#dffcf5}
.sales-donut .donut-fill{stroke:#00e6ae}
.expense-donut .donut-track{stroke:#ffe5e8}
.expense-donut .donut-fill{stroke:#ff5065}
@keyframes pw-donut-draw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@media(prefers-reduced-motion:reduce){.donut-fill{animation:none;stroke-dashoffset:0}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Added reliable left-to-right clockwise donut loading animation without changing size or interface.");
