const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "dashboard", "dashboard.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise device-responsive dashboard interactions */";

if (!css.includes(marker)) {
  css += `

${marker}
/* Fluid dashboard sizing: the same interface scales between desktop, tablet and phone. */
.dashboard-reference-header{padding-inline:clamp(14px,2.2vw,24px)}
.dashboard-reference-header h1{font-size:clamp(21px,2.1vw,27px)}
.dashboard-reference-actions{gap:clamp(6px,1vw,10px)}
.dashboard-date-pill,.dashboard-refresh-icon{height:clamp(38px,3.2vw,40px)}
.dashboard-date-pill{padding-inline:clamp(9px,1.2vw,13px)}
.dashboard-period-bar{padding-inline:clamp(10px,1.5vw,16px)}
.dashboard-period-bar strong{font-size:clamp(11px,1vw,12px)}
.dashboard-stats{padding-inline:clamp(14px,2.2vw,24px);grid-template-columns:repeat(4,minmax(0,1fr))}
.dashboard-reference-grid{padding-inline:clamp(14px,2.2vw,24px);grid-template-columns:repeat(2,minmax(0,1fr))}
.dashboard-card{padding:clamp(13px,1.35vw,15px);min-width:0}
.reference-card-title{min-width:0}.reference-card-title>div:first-child{min-width:0}
.reference-card-title h2{font-size:clamp(14px,1.35vw,15px)}
.reference-select{min-height:38px;height:clamp(38px,3.2vw,40px);padding-inline:clamp(9px,1.2vw,12px);font-size:clamp(11px,1vw,12px)}
.today-summary-metrics{gap:clamp(16px,2vw,22px) clamp(18px,3vw,32px)}
.summary-metric strong{font-size:clamp(16px,1.7vw,19px)}
.donut{width:clamp(120px,11vw,156px);height:clamp(120px,11vw,156px)}
.donut>div{width:72%;height:72%}
.donut strong{font-size:clamp(12px,1.35vw,15px);white-space:nowrap}
.table-card{min-width:0}.reference-table{width:100%;overflow-x:auto}

@media (max-width: 1100px){
  .dashboard-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dashboard-reference-grid{grid-template-columns:1fr}
  .today-summary-card,.sales-expenses-card{min-height:0}
}

@media (max-width: 700px){
  .dashboard-reference-header{height:62px}
  .dashboard-reference-header h1{font-size:22px}
  .dashboard-period-bar{flex-wrap:wrap;gap:8px}
  .dashboard-period-bar>div:first-child{min-width:0;flex:1}
  .period-tabs{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}
  .period-tabs button{min-height:40px}
  .dashboard-stats{grid-template-columns:1fr 1fr;padding-top:10px;gap:8px}
  .dash-stat{padding:11px;gap:8px}
  .dash-stat strong{font-size:16px;overflow-wrap:anywhere}
  .stat-icon{width:34px;height:34px}
  .today-summary-metrics{gap:16px 12px}
  .summary-metric{align-items:flex-start}
  .summary-icon{width:38px;height:38px}
  .summary-metric span{font-size:9px}
  .summary-metric strong{font-size:16px}
  .donut-pair{gap:8px;min-height:205px}
  .donut-legend{font-size:10px}
  .reference-table-head,.reference-table-row{grid-template-columns:48px minmax(110px,1fr) 82px}
}

@media (max-width: 420px){
  .dashboard-date-pill{display:none}
  .dashboard-stats{grid-template-columns:1fr}
  .dashboard-stats .dash-stat{min-height:68px}
  .today-summary-metrics{grid-template-columns:1fr}
  .donut-pair{grid-template-columns:1fr 1fr;min-height:185px}
  .donut{width:112px;height:112px}
  .donut>div{width:76%;height:76%}
  .donut strong{font-size:11px}
  .donut span{font-size:9px}
  .reference-report-button{min-height:42px}
}

@media (hover:none) and (pointer:coarse){
  .dashboard-refresh-icon,.dashboard-date-pill,.reference-select,.period-tabs button,.reference-report-button{min-height:44px}
  .dashboard-refresh-icon{width:44px}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied device-responsive dashboard interaction sizing.");
