const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "scripts", "patch-pos-discount-modal.js");
let script = fs.readFileSync(targetPath, "utf8");

const old = '  const paymentMarker = \'        {paymentModalOpen && <div className="payment-modal-overlay"\';\n  if (!page.includes(paymentMarker)) throw new Error("Payment modal marker not found");\n  page = page.replace(paymentMarker, modal + paymentMarker);';
const replacement = '  const paymentMarker = \'{paymentModalOpen &&\';\n  const paymentIndex = page.indexOf(paymentMarker);\n  if (paymentIndex === -1) throw new Error("Payment modal marker not found");\n  page = page.slice(0, paymentIndex) + modal + page.slice(paymentIndex);';

if (script.includes(old)) {
  script = script.replace(old, replacement);
  fs.writeFileSync(targetPath, script, "utf8");
  console.log("PrintWise: Fixed discount modal insertion marker to use the existing payment JSX anchor.");
} else {
  console.log("PrintWise: Discount modal marker fix already applied or source differs; continuing.");
}
