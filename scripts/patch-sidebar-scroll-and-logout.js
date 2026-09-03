const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "components", "Sidebar.tsx");
let source = fs.readFileSync(filePath, "utf8");
const marker = "/* PrintWise fixed sidebar scroll and footer v2 */";

// Move logout out of the scrollable navigation area so it remains pinned at the bottom.
const logoutBlock = `          <button type="button" className="sidebar-logout" onClick={signOut}>
            <LogOut size={18} /><span>LOG OUT</span>
          </button>`;
const logoutBlockWithFooter = `        </div>

        <div className="sidebar-fixed-footer">
${logoutBlock}
        </div>`;

if (!source.includes("sidebar-fixed-footer") && source.includes(logoutBlock)) {
  source = source.replace(
    `${logoutBlock}\n        </div>\n      </aside>`,
    logoutBlockWithFooter + `\n      </aside>`,
  );
}

if (!source.includes(marker)) {
  const oldBase = `.sidebar-compact{align-self:flex-start;flex:0 0 300px;height:auto!important;min-height:0!important}`;
  const oldScroll = `.sidebar-compact .sidebar-scroll{flex:none!important;overflow:visible!important;padding-bottom:12px!important}`;
  const oldTablet = `.sidebar-compact{align-self:stretch;height:auto!important;min-height:100vh!important;flex-basis:72px!important}`;
  const oldTabletScroll = `.sidebar-compact .sidebar-scroll{overflow:visible!important}`;

  source = source.replace(oldBase, `.sidebar-compact{align-self:flex-start;position:fixed!important;left:0;top:0;bottom:0;flex:0 0 300px;width:300px;height:100vh!important;min-height:100vh!important;max-height:100vh!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}`);
  source = source.replace(oldScroll, `.sidebar-compact .sidebar-scroll{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding:0 0 12px!important;-webkit-overflow-scrolling:touch}`);
  source = source.replace(oldTablet, `.sidebar-compact{align-self:stretch;width:72px!important;height:100vh!important;min-height:100vh!important;max-height:100vh!important;flex-basis:72px!important}`);
  source = source.replace(oldTabletScroll, `.sidebar-compact .sidebar-scroll{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important}`);

  const footerCss = `
        ${marker}
        /* Navigation items scroll inside the pane; logout stays permanently visible at the bottom. */
        .sidebar-compact .sidebar-fixed-footer{flex:0 0 auto!important;margin-top:auto!important;padding:10px 0 0!important;background:inherit;border-top:1px solid rgba(255,255,255,.08);z-index:2}
        .sidebar-compact .sidebar-fixed-footer .sidebar-logout{margin:0!important;min-height:48px!important}
        @media(max-width:1100px){
          .sidebar-compact .sidebar-fixed-footer{padding-top:8px!important}
        }
        @media(max-width:700px){
          .sidebar-compact .sidebar-fixed-footer{padding:8px 0 max(8px,env(safe-area-inset-bottom))!important}
          .sidebar-compact .sidebar-scroll{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding-bottom:10px!important}
        }
`;
  source = source.replace(`      ` + "`}</style>", footerCss + `      ` + "`}</style>");
  fs.writeFileSync(filePath, source, "utf8");
}

console.log("PrintWise: Navigation now scrolls internally and logout stays fixed at the bottom.");
