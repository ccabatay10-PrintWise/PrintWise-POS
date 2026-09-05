const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
const pageMarker = "/* PrintWise Discount navigation blur state */";
const cssMarker = "/* PrintWise Discount navigation blur */";

let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!page.includes(pageMarker)) {
  const stateNeedle = '  const [discountModalOpen, setDiscountModalOpen] = useState(false);';
  if (!page.includes(stateNeedle)) {
    throw new Error("Discount modal state marker not found; cannot wire navigation blur.");
  }

  const injected = `${stateNeedle}\n\n  ${pageMarker}\n  useEffect(() => {\n    document.body.classList.toggle("printwise-discount-open", discountModalOpen);\n    return () => document.body.classList.remove("printwise-discount-open");\n  }, [discountModalOpen]);`;
  page = page.replace(stateNeedle, injected);
  fs.writeFileSync(pagePath, page, "utf8");
}

if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n/* Match the Orders modal treatment without changing the existing Discount modal interface. */\nbody.printwise-discount-open .sidebar-compact{filter:blur(7px);opacity:.74;transition:filter .16s ease,opacity .16s ease;pointer-events:none}\nbody.printwise-discount-open .sidebar-compact::after{content:"";position:absolute;inset:0;background:rgba(10,15,22,.28);pointer-events:none}\n.discount-modal-overlay{z-index:2147483000!important;background:rgba(15,23,42,.72)!important;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}\n.discount-modal-card{position:relative;z-index:1}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Discount modal now uses the same full-screen dark blur effect as Orders without changing its interface.");
