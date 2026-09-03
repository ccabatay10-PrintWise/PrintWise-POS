const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");

let page = fs.readFileSync(pagePath, "utf8");
const importMarker = 'import POSSidebar from "../components/POSSidebar";';
if (!page.includes(importMarker)) {
  page = page.replace('import Sidebar from "../components/Sidebar";', importMarker);
  page = page.replace(/import POSSidebar from "\.\.\/components\/POSSidebar";\s*import Sidebar from "\.\.\/components\/Sidebar";/, importMarker);
}
page = page.replace(/import Sidebar from "\.\.\/components\/Sidebar";\s*/g, "");
page = page.replace(/\n\s*<Sidebar \/>/, "\n      <POSSidebar />");
fs.writeFileSync(pagePath, page, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise dedicated POS sidebar */";
if (!css.includes(marker)) {
  css += `

${marker}
/* The POS terminal has its own operational sidebar; the general navigation sidebar is not reused here. */
.pos-sidebar{width:248px;min-width:248px;height:100vh;position:sticky;top:0;box-sizing:border-box;background:#20242a;color:#fff;display:flex;flex-direction:column;padding:18px 12px;overflow-y:auto;border-right:1px solid #30343b;z-index:20}
.pos-sidebar-brand{display:flex;align-items:center;gap:10px;padding:7px 9px 25px}
.pos-sidebar-logo{width:38px;height:38px;border-radius:10px;background:#d71920;color:#fff;display:grid;place-items:center;flex:0 0 auto}
.pos-sidebar-brand strong{display:block;font-size:13px;letter-spacing:.9px;line-height:1.2}
.pos-sidebar-brand small{display:block;margin-top:4px;color:#aab0b9;font-size:10px}
.pos-sidebar-section-label{font-size:10px;letter-spacing:1.2px;color:#8f96a1;padding:0 10px 9px;margin-top:2px}
.pos-sidebar-nav{display:grid;gap:2px}
.pos-sidebar-item{width:100%;box-sizing:border-box;min-height:44px;border:0;background:transparent;color:#c9ced6;display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:9px;text-decoration:none;font-size:12px;font-weight:600;transition:background .15s ease,color .15s ease}
.pos-sidebar-item:hover{background:#2d3239;color:#fff}
.pos-sidebar-item.active{background:#363b43;color:#fff;box-shadow:inset 3px 0 #d71920}
.pos-sidebar-icon{width:20px;height:20px;display:grid;place-items:center;color:#aeb5bf;flex:0 0 auto}
.pos-sidebar-item.active .pos-sidebar-icon{color:#fff}
.pos-sidebar-arrow{margin-left:auto;color:#737b86}
.pos-sidebar-divider{height:1px;background:#343940;margin:16px 6px}
.pos-sidebar-footer{margin-top:auto;padding-top:14px;border-top:1px solid #343940}
.pos-sidebar-user{display:flex;align-items:center;gap:10px;padding:4px 7px 12px;min-width:0}
.pos-sidebar-user>div{min-width:0}
.pos-sidebar-user b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pos-sidebar-user small{display:block;margin-top:3px;color:#969da7;font-size:10px}
.pos-sidebar-avatar{width:34px;height:34px;border-radius:50%;background:#d71920;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;flex:0 0 auto}
.pos-sidebar-logout,.pos-sidebar-back{width:100%;min-height:42px;box-sizing:border-box;border-radius:9px;display:flex;align-items:center;gap:9px;padding:9px 11px;font-size:11px;font-weight:700;text-decoration:none}
.pos-sidebar-logout{border:1px solid #41464e;background:transparent;color:#d4d8de;cursor:pointer}
.pos-sidebar-logout:hover{background:#2d3239;color:#fff}
.pos-sidebar-back{margin-top:7px;color:#9fa6b0}
.pos-sidebar-back:hover{background:#2b3037;color:#fff}

@media(max-width:1100px){
  .pos-sidebar{width:72px;min-width:72px;padding:18px 8px}
  .pos-sidebar-brand{justify-content:center;padding:7px 4px 25px}
  .pos-sidebar-brand>div:last-child,.pos-sidebar-section-label,.pos-sidebar-item>span:not(.pos-sidebar-icon),.pos-sidebar-arrow,.pos-sidebar-user>div,.pos-sidebar-logout span,.pos-sidebar-back span{display:none}
  .pos-sidebar-item{justify-content:center;padding:10px 8px}
  .pos-sidebar-icon{width:22px}
  .pos-sidebar-user{justify-content:center;padding-inline:0}
  .pos-sidebar-logout,.pos-sidebar-back{justify-content:center;padding-inline:0}
}

@media(max-width:700px){
  .pos-sidebar{display:none}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: POS now uses its dedicated POS sidebar, separate from general navigation.");
