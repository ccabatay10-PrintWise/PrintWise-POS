const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "received-files", "page.tsx");
let source = fs.readFileSync(filePath, "utf8");
const marker = "/* PrintWise fixed navigation overlap correction */";

if (!source.includes(marker)) {
  const css = `\n${marker}\n/* Keep the general navigation fixed while reserving its full width in the received-files workspace. */\n.received-shell{position:relative;min-height:100vh}\n.received-shell>.sidebar-compact{position:fixed!important;left:0;top:0;bottom:0;width:300px!important;height:100vh!important;min-height:100vh!important;max-height:100vh!important;flex:0 0 300px!important;z-index:2000!important;overflow:hidden!important}\n.received-shell>.sidebar-compact .sidebar-scroll{flex:1!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important}\n.received-shell>.received-main{margin-left:300px;width:calc(100% - 300px);max-width:none;min-width:0}\n@media(max-width:1100px){\n  .received-shell>.sidebar-compact{width:72px!important;min-height:100vh!important;flex-basis:72px!important}\n  .received-shell>.received-main{margin-left:72px;width:calc(100% - 72px)}\n}\n@media(max-width:700px){\n  .received-shell>.sidebar-compact{position:fixed!important;width:min(88vw,320px)!important;height:100dvh!important;min-height:100dvh!important;max-height:100dvh!important;transform:translateX(-105%);}\n  .received-shell>.sidebar-compact.mobile-open{transform:translateX(0)!important}\n  .received-shell>.received-main{margin-left:0;width:100%}\n}\n`;
  source = source.replace("const styles = `", `const styles = \`${css}`);
  fs.writeFileSync(filePath, source, "utf8");
}

console.log("PrintWise: Fixed received-files content overlap with the fixed navigation pane.");
