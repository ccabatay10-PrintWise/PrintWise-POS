const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "scripts", "patch-pos-shift-modal.js");
let source = fs.readFileSync(targetPath, "utf8");

// The Shift JSX is generated from a JavaScript template literal. Escape only
// the React template expressions so they survive until the generated TSX runs.
[
  "shiftModalOpen",
  "shiftReadingTab",
  "shiftExpenseTab",
  "shiftInventoryTab",
  "shiftExpenseName",
  "shiftExpenseAmount",
].forEach((name) => {
  source = source.replaceAll(`\\${name}`, `\\${name}`);
});

// Convert the raw React expressions in the modal template into literal ${...}
// sequences without touching the patch script's own cssMarker interpolation.
const names = [
  "shiftModalOpen",
  "shiftReadingTab",
  "shiftExpenseTab",
  "shiftInventoryTab",
  "shiftExpenseName",
  "shiftExpenseAmount",
];
for (const name of names) {
  source = source.replaceAll(`\${name}`, `\\$\{${name}`);
}

fs.writeFileSync(targetPath, source, "utf8");
console.log("PrintWise: Fixed Shift popup template interpolation before build.");
