"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { IdeaCard } from "@/components/dashboard/idea-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IdeaCard as IdeaCardType } from "@/types";
import {
  Search,
  Loader2,
  Inbox,
  ArrowUpDown,
  SortAsc,
  SortDesc,
} from "lucide-react";

type StatusTab = "all" | "pending" | "approved" | "in_progress" | "launched" | "declined";
type SortField = "priority_score" | "discovered_at" | "reddit_mention_count";
type SortOrder = "asc" | "desc";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "launched", label: "Launched" },
  { value: "declined", label: "Declined" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "priority_score", label: "Priority" },
  { value: "discovered_at", label: "Date Discovered" },
  { value: "reddit_mention_count", label: "Reddit Mentions" },
];

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<IdeaCardType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("priority_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("sort", sortField);
      params.set("order", sortOrder);
      params.set("limit", "100");

      const res = await fetch(`/api/ideas?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIdeas(data.ideas);
        setTotal(data.total);
      }
    } catch {
      // failed to fetch
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, sortField, sortOrder]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  function handleStatusChange(id: string, newStatus: string) {
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, status: newStatus } : idea
      )
    );
  }

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  }

  function handleSortChange(field: SortField) {
    if (field === sortField) {
      toggleSortOrder();
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }

  // Counts per tab (derived from current ideas if tab is "all")
  const tabCounts = useMemo(() => {
    if (activeTab !== "all") return null;
    const counts: Record<string, number> = {};
    for (const idea of ideas) {
      counts[idea.status] = (counts[idea.status] || 0) + 1;
    }
    return counts;
  }, [ideas, activeTab]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Ideas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse, filter, and manage your peptide product ideas
        </p>
      </div>

      {/* Toolbar: tabs + search + sort */}
      <div className="space-y-4 mb-6">
        {/* Status tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            const count =
              tab.value === "all"
                ? total
                : tabCounts?.[tab.value] ?? null;

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-violet-100 text-violet-700"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                )}
              >
                {tab.label}
                {count !== null && activeTab === "all" && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full",
                      isActive
                        ? "bg-violet-200 text-violet-800"
                        : "bg-gray-200 text-gray-600"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ideas by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-colors"
            />
          </div>

          {/* Sort buttons */}
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-4 h-4 text-gray-400 mr-1" />
            {SORT_OPTIONS.map((option) => {
              const isActive = sortField === option.value;
              return (
                <Button
                  key={option.value}
                  variant={isActive ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => handleSortChange(option.value)}
                  className={cn(
                    "gap-1",
                    isActive && "font-semibold"
                  )}
                >
                  {option.label}
                  {isActive &&
                    (sortOrder === "desc" ? (
                      <SortDesc className="w-3 h-3" />
                    ) : (
                      <SortAsc className="w-3 h-3" />
                    ))}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-gray-400 mb-4">
          Showing {ideas.length} of {total} ideas
          {debouncedSearch && (
            <span>
              {" "}
              matching &quot;{debouncedSearch}&quot;
            </span>
          )}
        </p>
      )}

      {/* Ideas grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading ideas...</span>
        </div>
      ) : ideas.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm font-medium text-gray-500">No ideas found</p>
          <p className="text-xs text-gray-400 mt-1">
            {debouncedSearch
              ? "Try a different search term or clear filters"
              : "Ideas will appear here as the research engine discovers them"}
          </p>
          {debouncedSearch && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
              }}
            >
              Clear Search
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
