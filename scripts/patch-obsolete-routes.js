const fs = require("fs");
const path = require("path");
const root = process.cwd();

function patchReceivedFiles() {
  const filePath = path.join(root, "app", "received-files", "page.tsx");
  let source = fs.readFileSync(filePath, "utf8");
  const oldRoute = "window.location.href = `/received-files/${job.id}`;";
  const newRoute = "const firstFile = job.received_file_items?.[0]; if (firstFile) { const q = new URLSearchParams({ fileId: firstFile.id, name: firstFile.original_name }); window.location.href = `/received-files/${job.id}/smart-pricing?${q.toString()}`; } else { window.location.href = \"/received-files\"; }";
  if (source.includes(oldRoute)) source = source.replace(oldRoute, newRoute);
  fs.writeFileSync(filePath, source, "utf8");
}

function patchApproval() {
  const filePath = path.join(root, "app", "received-files", "[id]", "smart-pricing", "approval", "page.tsx");
  let source = fs.readFileSync(filePath, "utf8");
  const oldRoute = "window.location.href = `/received-files/${job.id}?smartFileId=${encodeURIComponent(file.id)}&smartPrice=${encodeURIComponent(finalNumber.toFixed(2))}&smartApproved=1`;";
  const newRoute = "const handoff = { jobId: job.id, referenceNo: job.reference_no, customerName: job.customer_name, contactNumber: \"\", items: [{ id: `received-file-${file.id}`, name: file.original_name, price: Number(finalNumber.toFixed(2)), quantity: Math.max(1, copies) }] }; sessionStorage.setItem(\"printwise_received_file_cart\", JSON.stringify(handoff)); window.location.href = \"/pos\";";
  if (source.includes(oldRoute)) source = source.replace(oldRoute, newRoute);
  fs.writeFileSync(filePath, source, "utf8");
}

patchReceivedFiles();
patchApproval();
console.log("PrintWise: Removed obsolete Incoming File Job navigation and routed workflows directly to Smart Pricing/POS.");
