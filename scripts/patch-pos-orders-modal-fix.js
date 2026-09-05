const fs = require("fs");
const path = require("path");

const patchPath = path.join(process.cwd(), "scripts", "patch-pos-orders-modal.js");
let source = fs.readFileSync(patchPath, "utf8");

// Escape the nested JSX template interpolation used by the generated modal.
source = source.replace(
  'setMessage(\\`Order ${order.order_no} selected.\\`);',
  'setMessage(\\`Order \\${order.order_no} selected.\\`);'
);

// The original insertion expected </main> to be the very last text in the
// file. POS has code after </main>, so that condition silently skipped the
// modal. Insert it immediately before the actual closing main tag instead.
source = source.replace(
  '  page = page.replace(/\\n    <\\/main>\\s*$/, modal + \'    </main>\');',
  '  const mainCloseIndex = page.lastIndexOf("\\n    </main>");\n  if (mainCloseIndex === -1) throw new Error("POS main closing marker not found");\n  page = page.slice(0, mainCloseIndex) + modal + "    </main>" + page.slice(mainCloseIndex + "\\n    </main>".length);'
);

// Make sure the Orders quick action is always wired, even if another patch
// has already created the quick-action rail.
source = source.replace(
  '  \'            <button type="button" className="pos-quick-action" title="View orders">\',',
  '  \'            <button type="button" className="pos-quick-action" onClick={openOrdersModal} title="View orders">\','
);

fs.writeFileSync(patchPath, source, "utf8");
console.log("PrintWise: Fixed Orders modal insertion and button wiring.");
