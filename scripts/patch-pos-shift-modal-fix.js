const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "scripts", "patch-pos-shift-modal.js");
let source = fs.readFileSync(targetPath, "utf8");

// Escape only React template expressions inside the generated JSX template.
const names = [
  "shiftModalOpen",
  "shiftReadingTab",
  "shiftExpenseTab",
  "shiftInventoryTab",
  "shiftExpenseName",
  "shiftExpenseAmount",
];

for (const name of names) {
  const needle = "${" + name;
  const replacement = "\\${" + name;
  source = source.split(needle).join(replacement);
}

fs.writeFileSync(targetPath, source, "utf8");
console.log("PrintWise: Fixed Shift popup template interpolation before build.");
