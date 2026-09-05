const fs = require("fs");
const path = require("path");
const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise Customer Display */";
const cssMarker = "/* PrintWise Customer Display styles */";

if (!page.includes(marker)) {
  const importMatch = page.match(/import \{([\s\S]*?)\} from "lucide-react";/);
  if (!importMatch) throw new Error("Customer Display: lucide-react import not found.");
  const iconNames = importMatch[1].split(",").map((x) => x.trim()).filter(Boolean);
  if (!iconNames.includes("MonitorUp")) iconNames.push("MonitorUp");
  page = page.replace(importMatch[0], `import {\n  ${iconNames.join(", ")}\n} from "lucide-react";`);

  const handoffMarker = '  const [handoffLoaded, setHandoffLoaded] = useState(false);';
  if (!page.includes(handoffMarker)) throw new Error("Customer Display: POS state marker not found.");
  const syncEffect = `

  ${marker}
  useEffect(() => {
    const displayOrder = {
      items: cart.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, image_url: item.image_url || null })),
      customer,
      subtotal,
      discount: discountAmount,
      total,
      updatedAt: new Date().toISOString(),
    };
    try { localStorage.setItem("printwise_customer_display_order", JSON.stringify(displayOrder)); } catch {}
    try {
      const channel = new BroadcastChannel("printwise_customer_display");
      channel.postMessage({ type: "order-update", order: displayOrder });
      channel.close();
    } catch {}
  }, [cart, customer, subtotal, discountAmount, total]);

  const openCustomerDisplay = () => {
    const display = window.open("/customer-display", "PrintWiseCustomerDisplay", "popup=yes,width=1280,height=800,resizable=yes,scrollbars=yes");
    if (!display) {
      setMessage("Customer Display could not be opened. Please allow pop-ups for PrintWise POS.");
      return;
    }
    try { display.focus(); } catch {}
  };
`;
  page = page.replace(handoffMarker, `${handoffMarker}${syncEffect}`);

  const launchButton = '<button className="customer-display-launch" onClick={openCustomerDisplay} title="Open Customer Display"><MonitorUp size={18} /><span>Customer Display</span></button>';
  const statusIndex = page.indexOf('<div className="status">');
  if (statusIndex !== -1) {
    page = page.slice(0, statusIndex) + launchButton + page.slice(statusIndex);
  } else {
    const topbarIndex = page.indexOf('<header className="topbar">');
    if (topbarIndex === -1) throw new Error("Customer Display: POS topbar marker not found.");
    const topbarOpenEnd = page.indexOf(">", topbarIndex) + 1;
    if (topbarOpenEnd <= 0) throw new Error("Customer Display: POS topbar opening tag not found.");
    page = page.slice(0, topbarOpenEnd) + launchButton + page.slice(topbarOpenEnd);
  }
  fs.writeFileSync(pagePath, page, "utf8");
}

if (!css.includes(cssMarker)) {
  css += `

${cssMarker}
.customer-display-launch{border:1px solid #e0e3e7;background:#fff;color:#555d67;border-radius:9px;min-height:40px;padding:0 13px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800;cursor:pointer}.customer-display-launch:hover{border-color:#d71920;color:#d71920;background:#fff8f8}@media(max-width:700px){.customer-display-launch span{display:none}.customer-display-launch{width:40px;padding:0}}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}
console.log("PrintWise: Added live Customer Display extension view and POS launcher.");
