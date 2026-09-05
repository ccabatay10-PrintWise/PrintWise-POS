const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "app", "pos", "page.tsx");
let page = fs.readFileSync(targetPath, "utf8");

const importMatch = page.match(/import \{([^}]*)\} from "lucide-react";/);
if (importMatch) {
  const names = importMatch[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  page = page.replace(importMatch[0], `import { ${uniqueNames.join(", ")} } from "lucide-react";`);
}

fs.writeFileSync(targetPath, page, "utf8");
console.log("PrintWise: deduplicated lucide-react imports after Shift live-data patch.");
