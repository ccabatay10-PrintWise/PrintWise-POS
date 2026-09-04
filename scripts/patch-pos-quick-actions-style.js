const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise POS quick action visual refinement */";
const forceMarker = "/* PrintWise POS quick action final neutral palette */";
const polishMarker = "/* PrintWise POS quick action final sizing and typography */";

if (!css.includes(marker)) {
  css += `\n\n${marker}\n/* Uniform white quick-action cards with one neutral gray icon/text color. */\n.pos-quick-actions{background:#f7f8fa}\n.pos-quick-action{background:#fff!important;border:1px solid #dfe4ea!important;color:#667085!important;box-shadow:0 1px 3px rgba(16,24,40,.06)!important}\n.pos-quick-action svg{color:#667085!important;stroke:currentColor!important}\n.pos-quick-action:hover{background:#fff!important;border-color:#cbd5df!important;color:#667085!important;box-shadow:0 4px 10px rgba(16,24,40,.08)!important}\n.pos-quick-action-active{background:#fff!important;border-color:#dfe4ea!important;color:#667085!important}\n.pos-quick-action-active svg{color:#667085!important}\n`;
}

/* Always emit a final override so an already-patched CSS file cannot retain the old green Shift state. */
if (!css.includes(forceMarker)) {
  css += `\n\n${forceMarker}\n.pos-quick-actions{background:#f7f8fa!important}\n.pos-quick-action,.pos-quick-action:hover,.pos-quick-action:focus,.pos-quick-action:active,.pos-quick-action-active{background:#fff!important;border-color:#dfe4ea!important;color:#667085!important}\n.pos-quick-action svg,.pos-quick-action-active svg{color:#667085!important;stroke:#667085!important}\n`;
}

/* Make the rail visibly cleaner: labels stay on one line and all controls share one balanced size. */
if (!css.includes(polishMarker)) {
  css += `\n\n${polishMarker}\n.pos-quick-actions{width:76px;box-sizing:border-box;align-items:center}\n.pos-quick-action{width:60px!important;min-width:60px!important;height:64px!important;min-height:64px!important;box-sizing:border-box;padding:7px 3px!important;gap:4px!important;border-radius:11px!important;color:#667085!important}\n.pos-quick-action svg{width:20px!important;height:20px!important;flex:0 0 20px}\n.pos-quick-action span{display:block!important;white-space:nowrap!important;overflow:visible!important;font-size:10px!important;line-height:12px!important;font-weight:500!important;color:#667085!important}\n.pos-quick-action-active,.pos-quick-action-active:hover{background:#fff!important;border-color:#dfe4ea!important;color:#667085!important}\n.pos-quick-action-active svg,.pos-quick-action-active span{color:#667085!important}\n@media(max-width:1100px){.pos-quick-actions{width:70px}.pos-quick-action{width:56px!important;min-width:56px!important}.pos-quick-action span{font-size:9px!important}}\n`;
}

fs.writeFileSync(cssPath, css, "utf8");
console.log("PrintWise: Applied final white/gray POS quick-action styling and balanced typography.");
