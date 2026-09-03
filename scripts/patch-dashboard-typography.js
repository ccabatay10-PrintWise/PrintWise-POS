const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "dashboard", "dashboard.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise refined dashboard typography hierarchy */";

if (!css.includes(marker)) {
  css += `

${marker}
/* Numbers are slightly larger and stronger; supporting text stays lighter. */
.dashboard-kpis .dash-stat span{font-size:11px;font-weight:600;color:#667085}
.dashboard-kpis .dash-stat strong{font-size:21px;font-weight:800;letter-spacing:-.35px;color:#172033}
.dashboard-kpis .dash-stat small{font-size:9px;font-weight:400;color:#98a2b3}
.dashboard-kpis .stat-icon{font-weight:500}
.reference-card-title h2{font-size:15px;font-weight:800;color:#172033}
.reference-card-title p{font-size:10px;font-weight:400;color:#667085}
.summary-metric span{font-size:10px;font-weight:500;color:#667085}
.summary-metric strong{font-size:20px;font-weight:750;letter-spacing:-.25px;color:#172033}
.summary-metric small{font-size:11px;font-weight:400;color:#98a2b3}
.last-order-panel{font-size:11px;font-weight:400;color:#3b5b85}
.last-order-panel b{font-weight:500}
.donut strong{font-size:16px;font-weight:800;letter-spacing:-.25px;color:#172033}
.donut span{font-size:10px;font-weight:400;color:#667085}
.donut-legend{font-size:10px;font-weight:600;color:#344054}
.reference-select{font-size:11px;font-weight:600}
.reference-report-button{font-size:11px;font-weight:600}
.reference-table-head{font-size:10px;font-weight:600;color:#667085}
.reference-table-row{font-size:11px;font-weight:400;color:#344054}
.reference-table-row b{font-weight:500;color:#344054}
.reference-table-row strong{font-weight:650;color:#172033}
.reference-table-row .stock-alert{font-weight:650}
.dashboard-empty{font-weight:400}

@media(max-width:700px){
  .dashboard-kpis .dash-stat strong{font-size:18px}
  .summary-metric strong{font-size:18px}
  .donut strong{font-size:14px}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied selective dashboard typography hierarchy.");
