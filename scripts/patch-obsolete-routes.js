const fs = require("fs");
const path = require("path");
const root = process.cwd();

async function patchReceivedFiles() {
  const filePath = path.join(root, "app", "received-files", "page.tsx");
  let source = fs.readFileSync(filePath, "utf8");
  const oldRoute = "window.location.href = `/received-files/${job.id}`;";
  const newRoute = "const firstFile = job.received_file_items?.[0]; if (firstFile) { const q = new URLSearchParams({ fileId: firstFile.id, name: firstFile.original_name }); window.location.href = `/received-files/${job.id}/smart-pricing?${q.toString()}`; } else { window.location.href = \"/received-files\"; }";
  if (source.includes(oldRoute)) source = source.replace(oldRoute, newRoute);

  const oldOpen = 'const openFile = async (file: NonNullable<Job["received_file_items"]>[number], download = false) => {';
  if (source.includes(oldOpen) && !source.includes('const markJobReviewing = async (jobId: string) =>')) {
    source = source.replace(oldOpen, 'const markJobReviewing = async (jobId: string) => {\n    try {\n      const { data: current } = await supabase.from("received_file_jobs").select("status").eq("id", jobId).single();\n      if (!current) return;\n      const currentStatus = String(current.status || "RECEIVED").toUpperCase();\n      if (currentStatus !== "RECEIVED" && currentStatus !== "REVIEWING") return;\n      if (currentStatus === "RECEIVED") {\n        const { error } = await supabase.from("received_file_jobs").update({ status: "REVIEWING" }).eq("id", jobId);\n        if (error) return;\n      }\n      const response = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, trigger: "REVIEWING", automatic: true }) });\n      if (!response.ok) console.error("PrintWise REVIEWING email failed", await response.text().catch(() => ""));\n    } catch (error) { console.error("PrintWise REVIEWING notification failed", error); }\n  };\n\n  ' + oldOpen);
  }
  source = source.replace('const openFile = async (file: NonNullable<Job["received_file_items"]>[number], download = false) => {\n    const { data, error }', 'const openFile = async (file: NonNullable<Job["received_file_items"]>[number], download = false) => {\n    await markJobReviewing(job.id);\n    const { data, error }');
  source = source.replace('const goToSmartPricing = (job: NonNullable<Job["received_file_items"]>[number]) => {\n    const q =', 'const goToSmartPricing = async (job: Job, file: NonNullable<Job["received_file_items"]>[number]) => {\n    await markJobReviewing(job.id);\n    const q =');
  source = source.replace('const goToSmartPricing = (job: Job, file: NonNullable<Job["received_file_items"]>[number]) => {\n    const q =', 'const goToSmartPricing = async (job: Job, file: NonNullable<Job["received_file_items"]>[number]) => {\n    await markJobReviewing(job.id);\n    const q =');
  fs.writeFileSync(filePath, source, "utf8");
}

function patchApproval() {
  const filePath = path.join(root, "app", "received-files", "[id]", "smart-pricing", "approval", "page.tsx");
  let source = fs.readFileSync(filePath, "utf8");
  const oldRoute = "window.location.href = `/received-files/${job.id}?smartFileId=${encodeURIComponent(file.id)}&smartPrice=${encodeURIComponent(finalNumber.toFixed(2))}&smartApproved=1`;";
  const newRoute = "const handoff = { jobId: job.id, referenceNo: job.reference_no, customerName: job.customer_name, contactNumber: \"\", items: [{ id: `received-file-${file.id}`, name: file.original_name, price: Number(finalNumber.toFixed(2)), quantity: Math.max(1, copies) }] }; const { error: processingError } = await supabase.from(\"received_file_jobs\").update({ status: \"PROCESSING\" }).eq(\"id\", job.id); if (processingError) throw new Error(processingError.message); const processingEmail = await fetch(\"/api/email/send\", { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, body: JSON.stringify({ jobId: job.id, trigger: \"PROCESSING\", automatic: true }) }); if (!processingEmail.ok) { const detail = await processingEmail.json().catch(() => ({})); throw new Error(detail.error || \"Unable to send the processing notification.\"); } sessionStorage.setItem(\"printwise_received_file_cart\", JSON.stringify(handoff)); window.location.href = \"/pos\";";
  if (source.includes(oldRoute)) source = source.replace(oldRoute, newRoute);
  fs.writeFileSync(filePath, source, "utf8");
}

function patchPos() {
  const filePath = path.join(root, "app", "pos", "page.tsx");
  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes("const [receivedJobId")) {
    source = source.replace('const [handoffLoaded, setHandoffLoaded] = useState(false);', 'const [handoffLoaded, setHandoffLoaded] = useState(false);\n  const [receivedJobId, setReceivedJobId] = useState("");');
  }
  if (!source.includes('setReceivedJobId(handoff.jobId')) {
    source = source.replace('const handoff = JSON.parse(raw) as ReceivedFileHandoff;', 'const handoff = JSON.parse(raw) as ReceivedFileHandoff;\n      setReceivedJobId(handoff.jobId || "");');
  }
  const paymentMarker = '    const receipt: CompletedReceipt = {';
  const paymentUpdate = '    if (receivedJobId) {\n      const { error: statusError } = await supabase.from("received_file_jobs").update({ status: "READY" }).eq("id", receivedJobId);\n      if (statusError) { setMessage(`Payment succeeded, but the received file status could not be updated: ${statusError.message}`); setSaving(false); return; }\n      const readyEmail = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: receivedJobId, trigger: "READY", automatic: true }) });\n      if (!readyEmail.ok) { const detail = await readyEmail.json().catch(() => ({})); setMessage(`Payment succeeded, but the ready notification could not be sent: ${detail.error || "Email service error"}`); setSaving(false); return; }\n    }\n\n';
  if (source.includes(paymentMarker) && !source.includes('Payment succeeded, but the ready notification could not be sent')) {
    source = source.replace(paymentMarker, paymentUpdate + paymentMarker);
  }
  fs.writeFileSync(filePath, source, "utf8");
}

function patchEmailTemplates() {
  const filePath = path.join(root, "app", "api", "email", "send", "route.ts");
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace('notificationType: "VALIDATING", subject: `Your Files Are Being Validated — ${reference}`, message: `Hi ${name},\\n\\nWe are currently validating your submitted files to ensure they are ready for processing.', 'notificationType: "REVIEWING", subject: `Your PrintWise Files Are Now Under Review — ${reference}`, message: `Hi ${name},\\n\\nYour submitted PrintWise files are now under review by our team. We are checking your documents before processing begins.');
  fs.writeFileSync(filePath, source, "utf8");
}

patchReceivedFiles();
patchApproval();
patchPos();
patchEmailTemplates();
console.log("PrintWise: Customer status notifications enabled for REVIEWING, PROCESSING, and READY.");
