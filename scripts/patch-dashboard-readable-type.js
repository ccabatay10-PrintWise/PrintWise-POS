const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "dashboard", "dashboard.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise readable dashboard typography v2 */";

if (!css.includes(marker)) {
  css += `

${marker}
/* Merchantry-level readability without changing the approved PrintWise donut layout. */
.dashboard-workspace{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.dashboard-header h1{font-size:28px;font-weight:700;letter-spacing:-.55px}
.dashboard-header p{font-size:14px;font-weight:400;line-height:1.5}
.dashboard-period-bar strong{font-size:14px;font-weight:600}
.period-label{font-size:11px;font-weight:700}
.period-tabs button{font-size:12px;font-weight:600}

/* KPI hierarchy: labels are readable, values are the visual anchor. */
.dashboard-stats .dash-stat span{font-size:13px;font-weight:500;color:#667085;margin-bottom:6px;line-height:1.3}
.dashboard-stats .dash-stat strong{font-size:25px;font-weight:750;line-height:1.15;letter-spacing:-.45px;color:#172033}
.dashboard-stats .dash-stat small{font-size:11px;font-weight:400;color:#98a2b3;line-height:1.35}
.dashboard-stats .stat-icon{font-weight:500}

/* Card titles and supporting descriptions. */
.reference-card-title h2{font-size:18px;font-weight:700;line-height:1.25;color:#172033}
.reference-card-title p{font-size:12px;font-weight:400;line-height:1.4;color:#667085}
.summary-metric span{font-size:13px;font-weight:500;line-height:1.3;color:#667085}
.summary-metric strong{font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-.3px;color:#172033}
.summary-metric small{font-size:11px;font-weight:400;color:#98a2b3}
.last-order-panel{font-size:12px;font-weight:400;line-height:1.55;color:#3b5b85}
.last-order-panel b{font-weight:600}

/* Financial donuts: prominent amounts, quiet labels. */
.donut strong{font-size:18px;font-weight:750;line-height:1.15;letter-spacing:-.3px;color:#172033}
.donut span{font-size:11px;font-weight:400;line-height:1.3;color:#667085}
.donut-legend{font-size:12px;font-weight:500;color:#344054}
.reference-select{font-size:12px;font-weight:600}
.reference-report-button{font-size:12px;font-weight:600}

/* Lists/tables: readable at normal desktop viewing distance. */
.reference-table-head{font-size:11px;font-weight:600;color:#667085}
.reference-table-row{font-size:12px;font-weight:400;line-height:1.45;color:#344054}
.reference-table-row b{font-weight:500;color:#344054}
.reference-table-row strong{font-weight:650;color:#172033}
.reference-table-row .stock-alert{font-weight:650}
.dashboard-empty{font-size:12px;font-weight:400;line-height:1.5}

@media(max-width:700px){
  .dashboard-header h1{font-size:24px}
  .dashboard-header p{font-size:13px}
  .dashboard-stats .dash-stat span{font-size:12px}
  .dashboard-stats .dash-stat strong{font-size:22px}
  .summary-metric span{font-size:12px}
  .summary-metric strong{font-size:20px}
  .reference-card-title h2{font-size:17px}
  .reference-card-title p{font-size:11px}
  .donut strong{font-size:16px}
  .donut span{font-size:10px}
  .donut-legend{font-size:11px}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied readable dashboard typography hierarchy v2.");
