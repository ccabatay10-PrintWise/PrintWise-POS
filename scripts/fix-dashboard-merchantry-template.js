const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "scripts", "patch-dashboard-merchantry.js");
let source = fs.readFileSync(file, "utf8");

const open = "const merchantryLayout = `";
const start = source.indexOf(open);
const end = source.indexOf("\n`;\n\ntsx =", start);
if (start < 0 || end < 0) {
  throw new Error("PrintWise: Merchantry template boundaries not found.");
}

const layoutStart = start + open.length;
let layout = source.slice(layoutStart, end);
const tick = String.fromCharCode(96);
const badHeight = "style={{ height: " + tick + "${Math.max((item.amount / maxTrend) * 100, item.amount > 0 ? 8 : 2)}%" + tick + " }}";
const safeHeight = 'style={{ height: String(Math.max((item.amount / maxTrend) * 100, item.amount > 0 ? 8 : 2)) + "%" }}';
layout = layout.split(badHeight).join(safeHeight);
layout = layout.replace(/\\?\$\{/g, "\\${");

source = source.slice(0, layoutStart) + layout + source.slice(end);
fs.writeFileSync(file, source, "utf8");
console.log("PrintWise: Fixed Merchantry dashboard build template syntax.");
