const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "scripts", "patch-pos-shift-modal.js");
let source = fs.readFileSync(targetPath, "utf8");

const oldText = "<span>Espacio · POS #1</span>";
const newText = "<span>{user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split(\"@\")[0] || \"PrintWise User\"} · POS #1</span>";

if (source.includes(oldText)) {
  source = source.replace(oldText, newText);
}

fs.writeFileSync(targetPath, source, "utf8");
console.log("PrintWise: Shift Reading now displays the logged-in account name instead of a hard-coded business name.");
