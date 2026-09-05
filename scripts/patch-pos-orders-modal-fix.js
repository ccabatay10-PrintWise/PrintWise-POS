const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "scripts", "patch-pos-orders-modal.js");
let source = fs.readFileSync(pagePath, "utf8");

// The Orders modal is stored inside a build-time template literal. Escape the
// JSX template interpolation so the patch script itself does not evaluate it.
source = source.replace(
  'setMessage(\\`Order ${order.order_no} selected.\\`);',
  'setMessage(\\`Order \\${order.order_no} selected.\\`);'
);

fs.writeFileSync(pagePath, source, "utf8");
console.log("PrintWise: Fixed Orders modal template interpolation.");
