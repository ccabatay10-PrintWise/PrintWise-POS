const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "globals.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise fixed navigation pane */";

if (!css.includes(marker)) {
  css += `

${marker}
/* Navigation stays fixed; only the application workspace is independently scrollable. */
@media(min-width:701px){
  .app-shell:has(.sidebar-compact){display:block;min-height:100vh}
  .sidebar-compact{position:fixed!important;left:0;top:0;bottom:0;width:300px!important;height:100vh!important;min-height:100vh!important;max-height:100vh!important;z-index:3000!important;overflow:hidden!important}
  .sidebar-compact .sidebar-scroll{flex:1!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch}
  .app-shell:has(.sidebar-compact) .workspace{margin-left:300px;width:calc(100% - 300px);height:100vh;max-width:none;overflow-y:auto;overflow-x:hidden}
}

@media(min-width:701px) and (max-width:1100px){
  .sidebar-compact{width:72px!important}
  .app-shell:has(.sidebar-compact) .workspace{margin-left:72px;width:calc(100% - 72px)}
}

@media(max-width:700px){
  .app-shell:has(.sidebar-compact) .workspace{margin-left:0;width:100%;height:auto;min-height:100dvh;overflow:visible}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Fixed the navigation pane so only the main workspace scrolls.");
