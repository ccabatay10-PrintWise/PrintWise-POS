const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Next.js standalone server was not generated. Run `npm run build` first.");
}

copyDirectory(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copyDirectory(path.join(root, "public"), path.join(standalone, "public"));

console.log("Prepared Next.js standalone runtime for PrintWise desktop packaging.");
