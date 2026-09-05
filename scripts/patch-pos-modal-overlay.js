const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");

const overlay = /\.pw-orders-overlay\{[^}]*\}/;
const replacement = ".pw-orders-overlay{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.72);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:26px;box-sizing:border-box}";

if (overlay.test(css)) {
  css = css.replace(overlay, replacement);
} else {
  css += `\n\n/* PrintWise POS modal overlay */\n${replacement}\n`;
}

fs.writeFileSync(cssPath, css, "utf8");
console.log("PrintWise: POS modal overlay now darkens and blurs the entire app, including navigation.");
