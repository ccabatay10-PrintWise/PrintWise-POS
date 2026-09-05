const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");

const marker = "/* PrintWise POS orders modal backdrop */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.pw-orders-overlay{backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);background:rgba(16,24,40,.78)}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Added dark blurred backdrop to Orders modal.");
