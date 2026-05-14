"use client";

import { useEffect, useState } from "react";

type Performance = { month: string; sales: number; revenue: number; views: number };
type Product = {
  id:          string;
  title:       string;
  price:       number | null;
  category:    string;
  status:      string;
  site:        { name: string; niche: string };
  performance: Performance[];
};
type Site = { id: string; name: string; niche: string };
type Opp  = { id: string; title: string; niche: string; score: number };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function ProductsPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [sites,      setSites]      = useState<Site[]>([]);
  const [opps,       setOpps]       = useState<Opp[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [selSite,    setSelSite]    = useState("");
  const [selOpp,     setSelOpp]     = useState("");
  const [manTitle,   setManTitle]   = useState("");
  const [price,      setPrice]      = useState("");
  const [perfFor,    setPerfFor]    = useState<string | null>(null);
  const [perfMonth,  setPerfMonth]  = useState(currentMonth());
  const [perfSales,  setPerfSales]  = useState("");
  const [perfRev,    setPerfRev]    = useState("");
  const [perfViews,  setPerfViews]  = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/sites").then((r) => r.json()),
      fetch("/api/digital-opps?status=VALIDATED").then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, s, o]) => {
      setProducts(p);
      setSites(s);
      setOpps(o);
      setLoading(false);
    });
  }, []);

  async function addProduct() {
    if (!selSite) return alert("Select a site");
    const opp   = opps.find((o) => o.id === selOpp);
    const title = manTitle || opp?.title || "Untitled";
    const res   = await fetch("/api/products", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        opportunityId: selOpp || null,
        siteId:        selSite,
        title,
        price:         price ? Number(price) : null,
        category:      opp?.niche ?? "unknown",
      }),
    });
    const product = await res.json();
    setProducts((prev) => [{ ...product, site: sites.find((s) => s.id === selSite)!, performance: [] }, ...prev]);
    setShowAdd(false);
    setSelSite(""); setSelOpp(""); setManTitle(""); setPrice("");
  }

  async function savePerformance(productId: string) {
    await fetch(`/api/products/${productId}/performance`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        month:     perfMonth,
        sales:     Number(perfSales)  || 0,
        revenue:   Number(perfRev)    || 0,
        views:     Number(perfViews)  || 0,
        favorites: 0,
      }),
    });
    setPerfFor(null);
    setPerfSales(""); setPerfRev(""); setPerfViews("");
    fetch("/api/products").then((r) => r.json()).then(setProducts);
  }

  const totalRevenue = products.flatMap((p) => p.performance).reduce((s, r) => s + r.revenue, 0);
  const totalSales   = products.flatMap((p) => p.performance).reduce((s, r) => s + r.sales, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} products — ${totalRevenue.toFixed(0)} total revenue — {totalSales} total sales
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 font-medium"
        >
          + Add Product
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Add Product</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Site *</label>
              <select value={selSite} onChange={(e) => setSelSite(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select site...</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From Opportunity (optional)</label>
              <select value={selOpp} onChange={(e) => {
                setSelOpp(e.target.value);
                const o = opps.find((op) => op.id === e.target.value);
                if (o) setManTitle(o.title);
              }} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Manual entry</option>
                {opps.map((o) => <option key={o.id} value={o.id}>{o.title.slice(0, 50)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Product Title *</label>
              <input type="text" value={manTitle} onChange={(e) => setManTitle(e.target.value)}
                placeholder="Enter product title..."
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Price (USD)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 12"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addProduct}
              className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 font-medium">
              Add Product
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-2">No products yet.</p>
          <p className="text-sm text-gray-400">Validate opportunities then add them here to track performance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {products.map((p) => {
            const lastPerf = p.performance[0];
            return (
              <div key={p.id} className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {p.site.niche.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-400">{p.site.name}</span>
                      <span className={"text-xs px-2 py-0.5 rounded font-medium " +
                        (p.status === "LIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {p.status}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{p.title}</p>
                    {p.price && <p className="text-sm text-gray-500 mt-0.5">${p.price}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {lastPerf ? (
                      <div>
                        <p className="text-lg font-bold text-gray-900">${lastPerf.revenue.toFixed(0)}</p>
                        <p className="text-xs text-gray-400">{lastPerf.sales} sales · {lastPerf.month}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-1">No data yet</p>
                    )}
                    <button
                      onClick={() => setPerfFor(perfFor === p.id ? null : p.id)}
                      className="text-xs px-2 py-1 bg-violet-100 text-violet-700 rounded hover:bg-violet-200 font-medium">
                      + Performance
                    </button>
                  </div>
                </div>

                {perfFor === p.id && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Enter Monthly Performance
                    </p>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Month</label>
                        <input type="month" value={perfMonth} onChange={(e) => setPerfMonth(e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Sales</label>
                        <input type="number" value={perfSales} onChange={(e) => setPerfSales(e.target.value)}
                          placeholder="0" className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Revenue ($)</label>
                        <input type="number" value={perfRev} onChange={(e) => setPerfRev(e.target.value)}
                          placeholder="0.00" className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Views</label>
                        <input type="number" value={perfViews} onChange={(e) => setPerfViews(e.target.value)}
                          placeholder="0" className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => savePerformance(p.id)}
                        className="px-3 py-1.5 bg-violet-600 text-white text-xs rounded hover:bg-violet-700 font-medium">
                        Save
                      </button>
                      <button onClick={() => setPerfFor(null)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 font-medium">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}