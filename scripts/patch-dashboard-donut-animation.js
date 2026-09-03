const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "dashboard", "dashboard.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise slow left-to-right donut loading animation */";

if (!css.includes(marker)) {
  css += `

${marker}
/* Preserve the existing donut dimensions and layout. Only animate the fill. */
@property --pw-donut-progress {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

.sales-donut,.expense-donut{
  --pw-donut-progress:0%;
  animation:pw-donut-fill 2.8s cubic-bezier(.22,.61,.36,1) 0s 1 normal forwards;
}

.sales-donut{
  background:conic-gradient(from 180deg,#00e6ae 0 var(--pw-donut-progress),#dffcf5 var(--pw-donut-progress) 100%)!important;
}

.expense-donut{
  background:conic-gradient(from 180deg,#ff5065 0 var(--pw-donut-progress),#ffe5e8 var(--pw-donut-progress) 100%)!important;
}

@keyframes pw-donut-fill{
  from{--pw-donut-progress:0%}
  to{--pw-donut-progress:100%}
}

@media(prefers-reduced-motion:reduce){
  .sales-donut,.expense-donut{animation:none;--pw-donut-progress:100%}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Added a slow left-to-right donut fill animation without changing donut size or layout.");
