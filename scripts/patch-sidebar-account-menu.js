const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "components", "Sidebar.tsx");
let source = fs.readFileSync(filePath, "utf8");
const marker = "/* PrintWise account popover menu */";

if (!source.includes(marker)) {
  source = source.replace("  Calculator,\n", "  Calculator,\n  ArrowLeftRight,\n  Building2,\n");
  source = source.replace("  ReceiptText,\n", "  ReceiptText,\n  RefreshCw,\n");
  source = source.replace("  UserPlus,\n", "  UserPlus,\n  UserCog,\n");
  source = source.replace("  const [mobileOpen, setMobileOpen] = useState(false);", "  const [mobileOpen, setMobileOpen] = useState(false);\n  const [accountMenuOpen, setAccountMenuOpen] = useState(false);\n  const [accountOwnerName, setAccountOwnerName] = useState(\"PrintWise Owner\");");
  source = source.replace("      setUserName(\n        user.user_metadata?.full_name ||", "      setUserName(\n        user.user_metadata?.full_name ||");
  source = source.replace("          \"PrintWise User\",\n      );\n      setUserRole(", "          \"PrintWise User\",\n      );\n      setAccountOwnerName(\n        user.user_metadata?.account_owner_name ||\n          user.user_metadata?.owner_name ||\n          user.user_metadata?.full_name ||\n          user.user_metadata?.name ||\n          user.email?.split(\"@\")[0] ||\n          \"PrintWise Owner\",\n      );\n      setUserRole(");

  const oldUserCard = `          <a className="sidebar-user-card" href="/dashboard" onClick={closeMobile}>
            <span className="sidebar-avatar">{avatarLetter}<i /></span>
            <span className="sidebar-user-copy"><b>{userName}</b><small>{roleLabel}</small></span>
            <ChevronRight size={18} />
          </a>`;
  source = source.replace(oldUserCard, "");

  const oldLogout = `          <button type="button" className="sidebar-logout" onClick={signOut}>
            <LogOut size={18} /><span>LOG OUT</span>
          </button>`;
  source = source.replace(oldLogout, "");

  const accountPopover = `        <div className="sidebar-fixed-footer">
          {accountMenuOpen && (
            <div className="sidebar-account-popover" role="menu">
              <div className="account-popover-business">
                <strong>{accountOwnerName}</strong>
                <span>Owner</span>
              </div>
              <button type="button" className="account-popover-item" onClick={() => window.location.reload()}>
                <RefreshCw size={18} /><span><b>Check for Updates</b><small>UI version 2026-09-01 09:49</small></span>
              </button>
              <button type="button" className="account-popover-item" onClick={() => router.push("/settings")}>
                <ArrowLeftRight size={18} /><span><b>Switch Account</b></span>
              </button>
              <button type="button" className="account-popover-item" onClick={() => router.push("/settings")}>
                <Building2 size={18} /><span><b>Add New Business</b></span>
              </button>
              <button type="button" className="account-popover-item" onClick={() => router.push("/settings")}>
                <UserCog size={18} /><span><b>User Settings</b></span>
              </button>
              <button type="button" className="account-popover-item account-popover-logout" onClick={signOut}>
                <LogOut size={18} /><span><b>Logout</b><small>Sign out of your account</small></span>
              </button>
            </div>
          )}
          <button type="button" className="sidebar-account-trigger" onClick={() => setAccountMenuOpen((value) => !value)} aria-expanded={accountMenuOpen} aria-haspopup="menu">
            <span className="sidebar-avatar">{avatarLetter}<i /></span>
            <span className="sidebar-user-copy"><b>{userName}</b><small>{roleLabel}</small></span>
            <ChevronRight className={accountMenuOpen ? "account-chevron-open" : ""} size={18} />
          </button>
        </div>`;
  source = source.replace(/        <div className="sidebar-fixed-footer">[\s\S]*?<\/div>/, accountPopover);

  const cssNeedle = ".sidebar-compact .sidebar-fixed-footer .sidebar-logout{margin:0!important;min-height:48px!important}";
  const cssReplacement = `${cssNeedle}
        .sidebar-compact .sidebar-account-trigger{width:100%;min-height:58px;border:0;background:transparent;color:inherit;display:flex;align-items:center;gap:10px;padding:7px 9px;border-radius:10px;text-align:left;cursor:pointer}
        .sidebar-compact .sidebar-account-trigger:hover{background:rgba(255,255,255,.05)}
        .sidebar-compact .account-chevron-open{transform:rotate(-90deg)}
        .sidebar-account-popover{position:absolute;left:8px;right:8px;bottom:calc(100% + 8px);background:#fff;color:#182230;border:1px solid #dfe4ea;border-radius:10px;box-shadow:0 12px 30px rgba(15,23,42,.18);overflow:hidden;z-index:50}
        .sidebar-fixed-footer{position:relative!important}
        .account-popover-business{padding:15px 16px 13px;border-bottom:1px solid #e5e7eb}
        .account-popover-business strong,.account-popover-business span{display:block}
        .account-popover-business strong{font-size:16px;font-weight:600;line-height:1.2}
        .account-popover-business span{font-size:12px;color:#70809a;margin-top:3px}
        .account-popover-item{width:100%;min-height:51px;border:0;border-bottom:1px solid #e5e7eb;background:#fff;color:#182230;display:flex;align-items:center;gap:13px;padding:9px 16px;text-align:left;cursor:pointer}
        .account-popover-item:hover{background:#f6f8fa}
        .account-popover-item>svg{color:#ef171d;flex:0 0 auto}
        .account-popover-item span{display:flex;flex-direction:column;min-width:0}
        .account-popover-item b{font-size:14px;font-weight:500;line-height:1.25}
        .account-popover-item small{font-size:12px;color:#7890ad;line-height:1.25;margin-top:2px}
        .account-popover-logout{border-bottom:0;color:#ef171d}
        .account-popover-logout>svg{color:#ef171d}
        .account-popover-logout small{color:#607998}`;
  source = source.replace(cssNeedle, cssReplacement);

  source = source.replace(".sidebar-compact .sidebar-fixed-footer{padding:8px 0 max(8px,env(safe-area-inset-bottom))!important}", ".sidebar-compact .sidebar-fixed-footer{padding:8px 0 max(8px,env(safe-area-inset-bottom))!important}\n          .sidebar-account-popover{left:0;right:0;bottom:calc(100% + 8px);max-height:calc(100dvh - 90px);overflow-y:auto}");

  fs.writeFileSync(filePath, source, "utf8");
}

console.log("PrintWise: Account popover icons use the PrintWise red accent.");
