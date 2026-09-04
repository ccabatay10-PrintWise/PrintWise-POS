const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise POS quick action visual refinement */";
const forceMarker = "/* PrintWise POS quick action final neutral palette */";

if (!css.includes(marker)) {
  css += `\n\n${marker}\n/* Uniform white quick-action cards with one neutral gray icon/text color. */\n.pos-quick-actions{background:#f7f8fa}\n.pos-quick-action{background:#fff!important;border:1px solid #dfe4ea!important;color:#667085!important;box-shadow:0 1px 3px rgba(16,24,40,.06)!important}\n.pos-quick-action svg{color:#667085!important;stroke:currentColor!important}\n.pos-quick-action:hover{background:#fff!important;border-color:#cbd5df!important;color:#667085!important;box-shadow:0 4px 10px rgba(16,24,40,.08)!important}\n.pos-quick-action-active{background:#fff!important;border-color:#dfe4ea!important;color:#667085!important}\n.pos-quick-action-active svg{color:#667085!important}\n`;
}

/* Always emit a final override so an already-patched CSS file cannot retain the old green Shift state. */
if (!css.includes(forceMarker)) {
  css += `\n\n${forceMarker}\n.pos-quick-actions{background:#f7f8fa!important}\n.pos-quick-action,.pos-quick-action:hover,.pos-quick-action:focus,.pos-quick-action:active,.pos-quick-action-active{background:#fff!important;border-color:#dfe4ea!important;color:#667085!important}\n.pos-quick-action svg,.pos-quick-action-active svg{color:#667085!important;stroke:#667085!important}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Forced POS quick actions to a white box / uniform gray palette.");
