const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
const pageMarker = "/* PrintWise Orders navigation blur state */";
const cssMarker = "/* PrintWise Orders navigation blur */";

let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!page.includes(pageMarker)) {
  const stateNeedle = '  const [ordersTab, setOrdersTab] = useState("Orders");';
  if (!page.includes(stateNeedle)) {
    throw new Error("Orders modal state marker not found; cannot wire navigation blur.");
  }

  const injected = `${stateNeedle}\n\n  ${pageMarker}\n  useEffect(() => {\n    document.body.classList.toggle("printwise-orders-open", ordersModalOpen);\n    return () => document.body.classList.remove("printwise-orders-open");\n  }, [ordersModalOpen]);`;
  page = page.replace(stateNeedle, injected);
  fs.writeFileSync(pagePath, page, "utf8");
}

if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n/* The sidebar is a separate fixed layer, so blur it explicitly while the Orders dialog is open. */\nbody.printwise-orders-open .sidebar-compact{filter:blur(7px);opacity:.74;transition:filter .16s ease,opacity .16s ease;pointer-events:none}\nbody.printwise-orders-open .sidebar-compact::after{content:"";position:absolute;inset:0;background:rgba(10,15,22,.28);pointer-events:none}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Orders modal now explicitly blurs and dims the fixed navigation sidebar.");
