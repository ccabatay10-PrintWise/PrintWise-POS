const fs = require("fs");
const path = require("path");

const root = process.cwd();
const filePath = path.join(root, "app", "received-files", "[id]", "smart-pricing", "page.tsx");
const patchPath = path.join(root, "scripts", "smart-pricing-docx-function.txt");
const source = fs.readFileSync(filePath, "utf8");
const replacement = fs.readFileSync(patchPath, "utf8").trimEnd() + "\n";

const start = source.indexOf("async function analyzeDocx(blob:Blob):Promise<Analysis>{");
const end = source.indexOf("function getPaperRate(", start);
if (start < 0 || end < 0) {
  throw new Error("Smart Pricing analyzeDocx markers were not found; refusing to patch the working page.");
}

const patched = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(filePath, patched, "utf8");
console.log("PrintWise: Smart Pricing DOCX image analyzer patched safely.");
