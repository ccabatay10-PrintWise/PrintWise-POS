const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
if (!fs.existsSync(pagePath)) {
  console.log("Customer display safe bridge skipped: POS page not found.");
  process.exit(0);
}

const page = fs.readFileSync(pagePath, "utf8");
if (page.includes("PRINTWISE_CUSTOMER_DISPLAY_SAFE")) {
  console.log("Customer display safe bridge already applied.");
  process.exit(0);
}

const importAnchor = 'import Sidebar from "../components/Sidebar";';
const topActions = '<div className="top-actions"><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div>';

if (!page.includes(importAnchor) || !page.includes(topActions)) {
  console.log("Customer display safe bridge skipped: current POS layout has changed.");
  process.exit(0);
}

let next = page.replace(
  importAnchor,
  `${importAnchor}\nimport CustomerDisplayLauncher from "../components/CustomerDisplayLauncher"; // PRINTWISE_CUSTOMER_DISPLAY_SAFE`
);

next = next.replace(
  topActions,
  '<div className="top-actions"><CustomerDisplayLauncher cart={cart} customer={customer} subtotal={subtotal} discount={discountAmount} total={total} /><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div>'
);

fs.writeFileSync(pagePath, next);
console.log("Applied isolated Customer Display bridge. The POS page contains no display-sync logic.");
