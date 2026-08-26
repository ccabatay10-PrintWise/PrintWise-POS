"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Package, ReceiptText, Search, Users, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type Customer = {
  name: string;
  orders: number;
  totalSpent: number;
  lastOrder: string;
};

type CustomerOrder = {
  customer_name: string | null;
  total: number | null;
  created_at: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true);
        setMessage("");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.access_token) {
          window.location.href = "/pos";
          return;
        }

        const response = await fetch("/api/customers", {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          cache: "no-store",
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load customers.");
        }

        const map = new Map<string, Customer>();
        for (const order of (payload.orders ?? []) as CustomerOrder[]) {
          const name = String(order.customer_name || "").trim();
          if (!name) continue;

          const key = name.toLowerCase();
          const existing = map.get(key);
          if (existing) {
            existing.orders += 1;
            existing.totalSpent += Number(order.total || 0);
          } else {
            map.set(key, {
              name,
              orders: 1,
              totalSpent: Number(order.total || 0),
              lastOrder: order.created_at,
            });
          }
        }

        setCustomers(Array.from(map.values()).sort((a, b) => b.lastOrder.localeCompare(a.lastOrder)));
      } catch (error) {
        setCustomers([]);
        setMessage(error instanceof Error ? error.message : "Unable to load customers.");
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const filtered = useMemo(
    () => customers.filter((customer) => customer.name.toLowerCase().includes(search.toLowerCase())),
    [customers, search]
  );

  const totalSales = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Users size={21} /></div>
          <span>PRINTWISE</span>
        </div>
        <div className="nav-label">MAIN MENU</div>
        <a className="nav-item" href="/pos"><ArrowLeft size={19} /><span>Point of Sale</span></a>
        <a className="nav-item" href="/orders"><ReceiptText size={19} /><span>Orders</span></a>
        <a className="nav-item" href="/products"><Package size={19} /><span>Products & Services</span></a>
        <a className="nav-item active" href="/customers"><Users size={19} /><span>Customers</span></a>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Customers</h1>
            <p>View customers automatically recorded from completed PrintWise orders.</p>
          </div>
        </header>

        <div className="pos-layout" style={{ gridTemplateColumns: "1fr" }}>
          <section className="catalog-panel">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 20 }}>
              <div className="summary" style={{ padding: 18 }}><div><span>Total Customers</span><b style={{ fontSize: 24 }}>{customers.length}</b></div></div>
              <div className="summary" style={{ padding: 18 }}><div><span>Total Customer Orders</span><b style={{ fontSize: 24 }}>{customers.reduce((sum, customer) => sum + customer.orders, 0)}</b></div></div>
              <div className="summary" style={{ padding: 18 }}><div><span>Customer Sales</span><b style={{ fontSize: 24, color: "#dc2626" }}>₱{totalSales.toFixed(2)}</b></div></div>
            </div>

            <div className="search-box">
              <Search size={19} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name..." />
            </div>

            {message && <div className="message">{message}</div>}

            <div style={{ overflowX: "auto", marginTop: 18 }}>
              <table className="orders-table">
                <thead>
                  <tr><th>Customer</th><th>Orders</th><th>Total Spent</th><th>Last Order</th></tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={4}>Loading customers...</td></tr> :
                    filtered.length === 0 ? <tr><td colSpan={4}>No customer records found yet. Customer names will appear here after orders are completed.</td></tr> :
                    filtered.map((customer) => (
                      <tr key={customer.name.toLowerCase()}>
                        <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><UserRound size={18} /><b>{customer.name}</b></div></td>
                        <td>{customer.orders}</td>
                        <td>₱{customer.totalSpent.toFixed(2)}</td>
                        <td>{new Date(customer.lastOrder).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
