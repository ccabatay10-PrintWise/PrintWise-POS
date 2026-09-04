const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise POS quick action visual refinement */";

if (!css.includes(marker)) {
  css += `\n\n${marker}\n/* Uniform white quick-action cards with one neutral gray icon/text color. */\n.pos-quick-actions{background:#f7f8fa}\n.pos-quick-action{background:#fff!important;border:1px solid #dfe4ea!important;color:#40556d!important;box-shadow:0 1px 3px rgba(16,24,40,.06)!important}\n.pos-quick-action svg{color:#40556d!important;stroke:currentColor!important}\n.pos-quick-action:hover{background:#fff!important;border-color:#cbd5df!important;color:#33485f!important;box-shadow:0 4px 10px rgba(16,24,40,.08)!important}\n.pos-quick-action-active{background:#fff!important;border-color:#dfe4ea!important;color:#40556d!important}\n.pos-quick-action-active svg{color:#40556d!important}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied uniform white/gray styling to POS quick actions.");
