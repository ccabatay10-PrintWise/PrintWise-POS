const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "dashboard", "dashboard.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise larger Sales and Expenses circles */";

if (!css.includes(marker)) {
  css += `

${marker}
/* Larger financial donuts. They remain fluid so they fit desktop, tablet and phone. */
.donut{width:clamp(150px,13vw,190px);height:clamp(150px,13vw,190px)}
.donut>div{width:72%;height:72%}
.donut strong{font-size:clamp(13px,1.5vw,16px)}
.donut span{font-size:clamp(9px,1vw,11px)}
.donut-pair{gap:clamp(16px,2.5vw,30px)}

@media (max-width:1100px){
  .donut{width:clamp(155px,22vw,190px);height:clamp(155px,22vw,190px)}
}

@media (max-width:700px){
  .donut-pair{gap:12px;min-height:225px}
  .donut{width:clamp(138px,38vw,170px);height:clamp(138px,38vw,170px)}
  .donut>div{width:72%;height:72%}
  .donut strong{font-size:13px}
  .donut span{font-size:9px}
}

@media (max-width:420px){
  .donut-pair{gap:8px;min-height:200px}
  .donut{width:clamp(130px,42vw,155px);height:clamp(130px,42vw,155px)}
  .donut strong{font-size:12px}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Enlarged Sales and Expenses financial circles responsively.");
