const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "pos", "page.tsx");
let page = fs.readFileSync(pagePath, "utf8");
const marker = "/* PrintWise POS Shift tab details */";

if (!page.includes(marker)) {
  const stateNeedle = '    products: [] as Array<{ name: string; category: string; quantity: number }>';
  if (!page.includes(stateNeedle)) throw new Error("Shift live-data state shape not found.");
  page = page.replace(stateNeedle, `${stateNeedle},\n    paymentRows: [] as Array<{ name: string; amount: number }>,\n    withdrawalRows: [] as Array<{ date: string; name: string; type: string; paymentMethod: string; amount: number }>,\n    cashDrawerRows: [] as Array<{ date: string; name: string; type: string; amount: number }>`);

  const beforeSetNeedle = '        const firstOrder = completed[0];\n        setShiftData({';
  if (!page.includes(beforeSetNeedle)) throw new Error("Shift data setter marker not found.");
  const rowLogic = `        const firstOrder = completed[0];\n        const openingFund = 500;\n        const paymentRows = successfulPayments.map((p: any) => ({\n          name: p.channel === "gcash" ? "GCash" : p.channel === "bank_transfer" ? "Bank Transfer" : p.channel === "bayad_center" ? "Bayad" : "Credit Card",\n          amount: money(p.amount)\n        }));\n        const withdrawalRows = withdrawalRowsRaw.map((p: any) => ({\n          date: new Date(p.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" }),\n          name: p.name || "Withdrawal", type: p.type || "Withdrawal", paymentMethod: p.channel || p.payment_method || "Cash", amount: money(p.amount)\n        }));\n        const cashDrawerRows = [\n          { date: firstOrder?.created_at ? new Date(firstOrder.created_at).toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "—", name: "Opening Fund", type: "Opening Fund", amount: openingFund },\n          { date: cashReceived > 0 ? new Date(now).toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "—", name: "Cash Payments", type: "Cash Payments", amount: cashReceived }\n        ];\n        setShiftData({`;
  page = page.replace(beforeSetNeedle, rowLogic);

  page = page.replace(
    'const withdrawalRows = (withdrawals || []).filter((p: any) => p.status === "successful");',
    'const withdrawalRowsRaw = (withdrawals || []).filter((p: any) => p.status === "successful");'
  );
  page = page.replace(
    'const withdrawn = withdrawalRows.reduce((sum: number, p: any) => sum + money(p.amount), 0);',
    'const withdrawn = withdrawalRowsRaw.reduce((sum: number, p: any) => sum + money(p.amount), 0);'
  );
  page = page.replace(
    'openingFund: 0, startTime:',
    'openingFund, startTime:'
  );
  page = page.replace(
    '          products\n        });',
    '          products, paymentRows, withdrawalRows, cashDrawerRows\n        });'
  );

  const placeholder = '<div className="pw-shift-tab-placeholder">{shiftReadingTab} details will appear here.</div>';
  if (!page.includes(placeholder)) throw new Error("Shift reading tab placeholder not found.");
  const tabDetails = `<div className="pw-shift-tab-content">{shiftReadingTab === 'Payments Received' ? <div className="pw-shift-data-table"><div className="pw-shift-data-head"><span>Name</span><span>Amount</span></div>{shiftData.paymentRows.length ? shiftData.paymentRows.map((row, i) => <div className="pw-shift-data-row" key={i}><span>{row.name}</span><span>₱{row.amount.toFixed(2)}</span></div>) : <div className="pw-shift-empty">No Payments Received</div>}<div className="pw-shift-data-total"><b>Total</b><b>₱{shiftData.payments.toFixed(2)}</b></div></div> : shiftReadingTab === 'Withdrawals' ? <div className="pw-shift-data-table"><div className="pw-shift-data-head pw-shift-withdrawal-grid"><span>Date</span><span>Name</span><span>Type</span><span>Payment Method</span><span>Amount</span></div>{shiftData.withdrawalRows.length ? shiftData.withdrawalRows.map((row, i) => <div className="pw-shift-data-row pw-shift-withdrawal-grid" key={i}><span>{row.date}</span><span>{row.name}</span><span>{row.type}</span><span>{row.paymentMethod}</span><span>₱{row.amount.toFixed(2)}</span></div>) : <div className="pw-shift-empty">No Withdrawals</div>}</div> : <div className="pw-shift-data-table"><div className="pw-shift-data-head pw-shift-cash-grid"><span>Date</span><span>Name</span><span>Type</span><span>Amount</span></div>{shiftData.cashDrawerRows.map((row, i) => <div className="pw-shift-data-row pw-shift-cash-grid" key={i}><span>{row.date}</span><span>{row.name}</span><span>{row.type}</span><span>₱{row.amount.toFixed(2)}</span></div>)}<div className="pw-shift-data-total"><b>Total</b><b>₱{(shiftData.openingFund + shiftData.cashInDrawer).toFixed(2)}</b></div></div>}</div>`;
  page = page.replace(placeholder, tabDetails);
  page = page.replace(marker, marker + "\n");

  fs.writeFileSync(pagePath, page, "utf8");
}

console.log("PrintWise: Added live Payment Received, Withdrawals, and Cash in Drawer tab details.");
