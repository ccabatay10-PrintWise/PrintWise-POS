const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
if (!fs.existsSync(pagePath)) {
  console.log("Customer display safe bridge skipped: POS page not found.");
  process.exit(0);
}

let page = fs.readFileSync(pagePath, "utf8");
if (page.includes("PRINTWISE_CUSTOMER_DISPLAY_SAFE")) {
  console.log("Customer display safe bridge already applied.");
  process.exit(0);
}

const importAnchor = 'import Sidebar from "../components/Sidebar";';
if (!page.includes(importAnchor)) {
  console.log("Customer display safe bridge skipped: Sidebar import anchor not found.");
  process.exit(0);
}

page = page.replace(
  importAnchor,
  `${importAnchor}\nimport CustomerDisplayLauncher from "../components/CustomerDisplayLauncher"; // PRINTWISE_CUSTOMER_DISPLAY_SAFE`
);

const topActionsRegex = /<div className="top-actions">/;
if (!topActionsRegex.test(page)) {
  console.log("Customer display safe bridge skipped: top actions container not found.");
  process.exit(0);
}

page = page.replace(
  topActionsRegex,
  '<div className="top-actions"><CustomerDisplayLauncher cart={cart} customer={customer} subtotal={subtotal} discount={discountAmount} total={total} />'
);

fs.writeFileSync(pagePath, page, "utf8");
console.log("Applied isolated Customer Display bridge. The POS page contains no display-sync logic.");
