const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "app", "pos", "page.tsx");
let page = fs.readFileSync(targetPath, "utf8");
const marker = "/* PrintWise POS Shift live data */";

if (!page.includes(marker)) {
  const importNeedle = '  Banknote, Barcode, CheckCircle2, CreditCard, FileText, Image, LogIn, Menu, Minus,';
  if (page.includes(importNeedle)) {
    page = page.replace(importNeedle, '  Banknote, Barcode, CheckCircle2, CreditCard, FileText, Image, LogIn, Menu, Minus, Clock3,');
  }

  const stateNeedle = '  const [handoffLoaded, setHandoffLoaded] = useState(false);';
  if (!page.includes(stateNeedle)) throw new Error("Shift live-data state marker not found.");

  const stateBlock = `${stateNeedle}\n  const [shiftData, setShiftData] = useState({\n    payments: 0, orders: 0, withdrawals: 0, cashInDrawer: 0, grossSales: 0, discount: 0, refund: 0, voids: 0,\n    shiftNumber: "N/A", businessDay: "", openingFund: 0, startTime: "Not recorded",\n    products: [] as Array<{ name: string; category: string; quantity: number }>\n  });\n\n  ${marker}`;
  page = page.replace(stateNeedle, stateBlock);

  const effectNeedle = '  useEffect(() => {\n    document.body.classList.toggle("printwise-shift-open", shiftModalOpen);\n    return () => document.body.classList.remove("printwise-shift-open");\n  }, [shiftModalOpen]);';
  if (!page.includes(effectNeedle)) throw new Error("Shift modal effect marker not found.");

  const effectBlock = `${effectNeedle}\n\n  useEffect(() => {\n    if (!shiftModalOpen || !user) return;\n    let cancelled = false;\n    const loadShiftData = async () => {\n      const now = new Date();\n      const start = new Date(now);\n      start.setHours(0, 0, 0, 0);\n      const endIso = now.toISOString();\n      const startIso = start.toISOString();\n      const money = (value: any) => Number(value || 0);\n      try {\n        const [{ data: orders }, { data: payments }, { data: withdrawals }] = await Promise.all([\n          supabase.from("pos_orders").select("id,order_no,status,subtotal,discount_amount,total,amount_paid,created_at").eq("created_by", user.id).gte("created_at", startIso).lte("created_at", endIso).order("created_at", { ascending: true }),\n          supabase.from("payment_transactions").select("amount,transaction_type,status,channel,created_at").eq("created_by", user.id).gte("created_at", startIso).lte("created_at", endIso),\n          supabase.from("payment_transactions").select("amount,transaction_type,status,created_at").eq("created_by", user.id).gte("created_at", startIso).lte("created_at", endIso).in("transaction_type", ["withdrawal", "cash_withdrawal"])\n        ]);\n\n        const completed = (orders || []).filter((o: any) => o.status === "completed");\n        const successfulPayments = (payments || []).filter((p: any) => p.status === "successful" && p.transaction_type === "payment");\n        const withdrawalRows = (withdrawals || []).filter((p: any) => p.status === "successful");\n        const grossSales = completed.reduce((sum: number, o: any) => sum + money(o.subtotal), 0);\n        const discount = completed.reduce((sum: number, o: any) => sum + money(o.discount_amount), 0);\n        const received = successfulPayments.reduce((sum: number, p: any) => sum + money(p.amount), 0);\n        const withdrawn = withdrawalRows.reduce((sum: number, p: any) => sum + money(p.amount), 0);\n        const cashReceived = successfulPayments.filter((p: any) => p.channel === "cash").reduce((sum: number, p: any) => sum + money(p.amount), 0);\n        const orderIds = completed.map((o: any) => o.id);\n        let products: Array<{ name: string; category: string; quantity: number }> = [];\n        if (orderIds.length) {\n          const { data: items } = await supabase.from("pos_order_items").select("product_id,item_name,quantity").in("pos_order_id", orderIds);\n          const productIds = Array.from(new Set((items || []).map((i: any) => i.product_id).filter(Boolean)));\n          let categoryMap: Record<string, string> = {};\n          if (productIds.length) {\n            const { data: productRows } = await supabase.from("products").select("id,category").in("id", productIds);\n            categoryMap = Object.fromEntries((productRows || []).map((p: any) => [p.id, p.category || ""]));\n          }\n          const grouped: Record<string, { name: string; category: string; quantity: number }> = {};\n          for (const item of (items || [])) {\n            const key = `${item.item_name}::${item.product_id || ""}`;\n            if (!grouped[key]) grouped[key] = { name: item.item_name, category: categoryMap[item.product_id] || "", quantity: 0 };\n            grouped[key].quantity += money(item.quantity);\n          }\n          products = Object.values(grouped).sort((a, b) => b.quantity - a.quantity);\n        }\n        if (cancelled) return;\n        const firstOrder = completed[0];\n        setShiftData({\n          payments: received, orders: completed.length, withdrawals: withdrawn, cashInDrawer: Math.max(0, cashReceived - withdrawn),\n          grossSales, discount, refund: 0, voids: 0, shiftNumber: "N/A", businessDay: now.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" }),\n          openingFund: 0, startTime: firstOrder?.created_at ? new Date(firstOrder.created_at).toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "Not recorded",\n          products\n        });\n      } catch (error) {\n        if (!cancelled) setMessage("Unable to load the current shift data from PrintWise.");\n      }\n    };\n    loadShiftData();\n    return () => { cancelled = true; };\n  }, [shiftModalOpen, user]);`;
  page = page.replace(effectNeedle, effectBlock);

  const replacements = [
    ['<strong>₱672.00</strong>', '<strong>₱{shiftData.payments.toFixed(2)}</strong>'],
    ['<strong>1</strong></div></div>\n                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><span>↓</span></div><div><small>Withdrawals</small>', '<strong>{shiftData.orders}</strong></div></div>\n                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><span>↓</span></div><div><small>Withdrawals</small>'],
    ['<strong>₱0.00</strong></div></div>\n                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><Banknote', '<strong>₱{shiftData.withdrawals.toFixed(2)}</strong></div></div>\n                <div className="pw-shift-kpi"><div className="pw-shift-kpi-icon"><Banknote'],
    ['<strong>₱500.00</strong></div></div>', '<strong>₱{shiftData.cashInDrawer.toFixed(2)}</strong></div></div>'],
    ['<b>SH000001</b>', '<b>{shiftData.shiftNumber}</b>'],
    ['<b>BD000001</b>', '<b>{shiftData.businessDay}</b>'],
    ['<b>₱500.00 <span className="pw-shift-pencil">⌕</span></b>', '<b>₱{shiftData.openingFund.toFixed(2)} <span className="pw-shift-pencil">⌕</span></b>'],
    ['<b>Sep 02, 2026, 10:40 AM</b>', '<b>{shiftData.startTime}</b>'],
    ['<b>₱840.00</b></div><div><span>Discount</span><b>₱168.00</b></div><div><span>Refund</span><b>₱0.00</b></div><div><span>Void</span><b>₱0.00</b></div>', '<b>₱{shiftData.grossSales.toFixed(2)}</b></div><div><span>Discount</span><b>₱{shiftData.discount.toFixed(2)}</b></div><div><span>Refund</span><b>₱{shiftData.refund.toFixed(2)}</b></div><div><span>Void</span><b>₱{shiftData.voids.toFixed(2)}</b></div>'],
    ['{(shiftInventoryTab === \'Products Sold\' ? [[\'TSHIRT\',\'SHIRTS\',\'1\'],[\'TSHIRT WITH DTF PRINT\',\'SHIRTS\',\'1\'],[\'PLAIN SHIRT\',\'SHIRTS\',\'1\']] : [[\'DTF FILM\',\'PRINTING MATERIALS\',\'1\'],[\'HEAT TRANSFER PAPER\',\'PRINTING MATERIALS\',\'1\']]).map((row, i) => <div className="pw-shift-table-row" key={i}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span></div>)}', '{(shiftInventoryTab === \'Products Sold\' ? shiftData.products : []).map((row, i) => <div className="pw-shift-table-row" key={i}><span>{row.name}</span><span>{row.category || "—"}</span><span>{row.quantity}</span></div>)}']
  ];
  for (const [oldText, newText] of replacements) page = page.split(oldText).join(newText);

  fs.writeFileSync(targetPath, page, "utf8");
}

console.log("PrintWise: Shift Reading now uses live data from the logged-in account's POS records.");
