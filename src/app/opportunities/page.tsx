"use client";

import { useEffect, useState } from "react";

type Opp = {
  id:         string;
  title:      string;
  niche:      string;
  platform:   string;
  score:      number;
  category:   string;
  summary:    string | null;
  status:     string;
  aiPlaybook: string | null;
  sourceUrl:  string | null;
};

const STATUSES = ["ALL", "QUEUED", "RESEARCHING", "VALIDATED", "BUILDING", "DISMISSED"];

function statusClass(s: string) {
  if (s === "QUEUED")      return "bg-yellow-100 text-yellow-800";
  if (s === "RESEARCHING") return "bg-blue-100 text-blue-800";
  if (s === "VALIDATED")   return "bg-green-100 text-green-800";
  if (s === "BUILDING")    return "bg-purple-100 text-purple-800";
  if (s === "DISMISSED")   return "bg-gray-100 text-gray-500";
  return "bg-gray-100 text-gray-600";
}

function scoreClass(n: number) {
  if (n >= 80) return "text-green-600";
  if (n >= 70) return "text-yellow-600";
  return "text-gray-500";
}

export default function OpportunitiesPage() {
  const [opps,     setOpps]     = useState<Opp[]>([]);
  const [filter,   setFilter]   = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [diving,   setDiving]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs  = filter === "ALL" ? "" : "?status=" + filter;
    fetch("/api/digital-opps" + qs)
      .then((r) => r.json())
      .then((d) => { setOpps(d); setLoading(false); });
  }, [filter]);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/digital-opps/" + id, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    setOpps((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  }

  async function deepDive(id: string) {
    setDiving(id);
    const res  = await fetch("/api/digital-opps/" + id + "/deep-dive", { method: "POST" });
    const data = await res.json();
    setOpps((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, aiPlaybook: data.playbook, status: "RESEARCHING" } : o
      )
    );
    setExpanded(id);
    setDiving(null);
  }

  const counts: Record<string, number> = {};
  for (const s of STATUSES.slice(1)) {
    counts[s] = opps.filter((o) => o.status === s).length;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Digital Opportunities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Synced from NicheIQ — review, deep dive, move to building
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {STATUSES.slice(1).map((s) => (
          <div key={s} className="bg-white rounded-lg border p-3 text-center">
            <div className="text-xl font-bold text-gray-900">{counts[s] ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">{s}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              filter === s
                ? "px-3 py-1.5 rounded-full text-sm font-medium bg-gray-900 text-white"
                : "px-3 py-1.5 rounded-full text-sm font-medium bg-white border text-gray-600 hover:bg-gray-50"
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : opps.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No opportunities found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {opps.map((opp) => (
            <div key={opp.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
              {/* Card row */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === opp.id ? null : opp.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {opp.niche.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-400">{opp.platform}</span>
                      <span className={"text-xs px-2 py-0.5 rounded font-medium " + statusClass(opp.status)}>
                        {opp.status}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{opp.title}</p>
                    {opp.summary && (
                      <p className="text-sm text-gray-500 mt-1">{opp.summary.slice(0, 120)}...</p>
                    )}
                  </div>
                  <div className={"text-2xl font-bold shrink-0 " + scoreClass(opp.score)}>
                    {Math.round(opp.score)}
                  </div>
                </div>
              </div>

              {/* Expanded */}
              {expanded === opp.id && (
                <div className="border-t px-4 pb-4 pt-3">
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <button
                      onClick={() => deepDive(opp.id)}
                      disabled={diving === opp.id}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                    >
                      {diving === opp.id ? "Analyzing..." : "🧠 Deep Dive"}
                    </button>
                    {opp.sourceUrl && (
                      <button
                        onClick={() => window.open(opp.sourceUrl!, "_blank")}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium"
                      >
                        🔗 Source
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(opp.id, "VALIDATED")}
                      className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 font-medium"
                    >
                      ✅ Validate
                    </button>
                    <button
                      onClick={() => updateStatus(opp.id, "BUILDING")}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 text-sm rounded-lg hover:bg-purple-200 font-medium"
                    >
                      🔨 Building
                    </button>
                    <button
                      onClick={() => updateStatus(opp.id, "DISMISSED")}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 font-medium"
                    >
                      ✕ Dismiss
                    </button>
                  </div>

                  {opp.aiPlaybook ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        AI Analysis
                      </div>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {opp.aiPlaybook}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Click Deep Dive to generate AI analysis.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}