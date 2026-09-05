const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "app", "pos", "page.tsx");
let page = fs.readFileSync(targetPath, "utf8");
page = page.replace(/openingFund, startTime:/g, "openingFund: 500, startTime:");
page = page.replace(/amount: openingFund/g, "amount: 500");
fs.writeFileSync(targetPath, page, "utf8");
console.log("PrintWise: Fixed Shift opening fund prerender reference.");
