const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise POS Shift tab detail table styles */";

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.pw-shift-tab-content{padding:0 0 22px}.pw-shift-data-table{width:100%;font-size:17px}.pw-shift-data-head,.pw-shift-data-row{min-height:46px;display:grid;grid-template-columns:1fr .42fr;align-items:center;border-bottom:1px solid #dfe3e8}.pw-shift-data-head{color:#707584;font-weight:600}.pw-shift-data-row span:last-child,.pw-shift-data-head span:last-child,.pw-shift-data-total b:last-child{text-align:right}.pw-shift-data-row span{color:#20242a}.pw-shift-data-total{min-height:46px;display:grid;grid-template-columns:1fr .42fr;align-items:center;background:#fafafa;padding:0 10px;color:#182230}.pw-shift-data-total b{font-weight:700}.pw-shift-empty{min-height:115px;display:grid;place-items:center;color:#20242a}.pw-shift-withdrawal-grid{grid-template-columns:1.05fr 1.05fr .9fr 1.45fr .65fr}.pw-shift-cash-grid{grid-template-columns:1.05fr 1.15fr 1.15fr .65fr}.pw-shift-data-head span,.pw-shift-data-row span{padding:0 10px}.pw-shift-data-row:nth-child(odd){background:#fff}@media(max-width:800px){.pw-shift-data-table{font-size:14px}.pw-shift-withdrawal-grid{min-width:760px}.pw-shift-cash-grid{min-width:620px}.pw-shift-tab-content{overflow-x:auto}}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}
console.log("PrintWise: Styled Shift Payment, Withdrawal, and Cash Drawer detail tables.");
`;
}