const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "app", "pos", "page.tsx");
const page = fs.readFileSync(targetPath, "utf8");
const marker = "/* PrintWise POS Shift live data */";

if (page.includes(marker) && page.includes("\\n")) {
  fs.writeFileSync(targetPath, page.replace(/\\n/g, "\n"), "utf8");
}

console.log("PrintWise: normalized Shift live-data generated newlines.");
