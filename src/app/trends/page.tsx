"use client";

import { useState, useEffect } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  MessageCircle,
  Lightbulb,
  BarChart3,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface RisingIdea {
  id: string;
  title: string;
  peptideTopics: string[];
  googleTrendsScore: number | null;
  googleTrendsDirection: string | null;
  redditMentionCount: number;
  youtubeVideoCount: number;
  priorityScore: number;
}

interface DecliningIdea {
  id: string;
  title: string;
  peptideTopics: string[];
  googleTrendsScore: number | null;
  googleTrendsDirection: string | null;
}

interface RecentIdea {
  id: string;
  title: string;
  category: string;
  discoverySource: string | null;
  priorityScore: number;
  discoveredAt: string;
}

interface CategoryGroup {
  category: string;
  _count: { id: number };
  _avg: { priorityScore: number | null };
}

interface TrendsData {
  rising: RisingIdea[];
  declining: DecliningIdea[];
  recentIdeas: RecentIdea[];
  topCategories: CategoryGroup[];
  researchPulse: number;
}

const CATEGORY_COLORS = [
  "#7c3aed",
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#4f46e5",
  "#818cf8",
  "#6d28d9",
];

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrends() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/trends");
        if (!res.ok) throw new Error("Failed to fetch trends");
        const json: TrendsData = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trends");
      } finally {
        setIsLoading(false);
      }
    }
    fetchTrends();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">{error || "No data available"}</p>
      </div>
    );
  }

  const chartData = data.topCategories.map((cat) => ({
    name: formatCategory(cat.category),
    count: cat._count.id,
    avgScore: Math.round(cat._avg.priorityScore ?? 0),
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Trends & Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Market signals, trending topics, and research activity
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
            data.researchPulse > 0
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          )}
        >
          <Activity
            className={cn(
              "w-4 h-4",
              data.researchPulse > 0
                ? "text-green-500 animate-pulse"
                : "text-gray-400"
            )}
          />
          Research Pulse: {data.researchPulse} scrapes/hr
        </div>
      </div>

      {/* Rising Stars */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900">Rising Stars</h2>
          <Badge variant="secondary" className="ml-1">
            {data.rising.length}
          </Badge>
        </div>
        {data.rising.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-400 text-center">
              No rising trends detected yet
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.rising.map((idea) => (
              <Card
                key={idea.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                      {idea.title}
                    </h3>
                    <span className="shrink-0 text-xs font-bold text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                      {idea.googleTrendsScore ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {idea.peptideTopics.slice(0, 3).map((topic) => (
                      <Badge
                        key={topic}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {idea.redditMentionCount} Reddit
                    </span>
                    <span>
                      Priority: {idea.priorityScore.toFixed(0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Declining */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-gray-900">Declining</h2>
            <Badge variant="secondary" className="ml-1">
              {data.declining.length}
            </Badge>
          </div>
          {data.declining.length === 0 ? (
            <Card className="p-6">
              <p className="text-sm text-gray-400 text-center">
                No declining trends found
              </p>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {data.declining.map((idea) => (
                    <div
                      key={idea.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700 truncate">
                          {idea.title}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {idea.peptideTopics.slice(0, 2).map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-red-500 bg-red-50 rounded-full px-2 py-0.5 shrink-0 ml-2">
                        {idea.googleTrendsScore ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Reddit Pulse */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Reddit Pulse
            </h2>
          </div>
          {data.recentIdeas.filter((i) =>
            i.discoverySource?.toLowerCase().includes("reddit")
          ).length === 0 ? (
            <Card className="p-6">
              <p className="text-sm text-gray-400 text-center">
                No Reddit discoveries recently
              </p>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {data.recentIdeas
                    .filter((i) =>
                      i.discoverySource?.toLowerCase().includes("reddit")
                    )
                    .slice(0, 6)
                    .map((idea) => (
                      <div
                        key={idea.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700 truncate">
                            {idea.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatRelativeTime(idea.discoveredAt)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0 ml-2">
                          {formatCategory(idea.category)}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <Separator />

      {/* Recent Discoveries */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Discoveries
          </h2>
        </div>
        {data.recentIdeas.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-400 text-center">
              No recent discoveries
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {data.recentIdeas.map((idea) => (
              <Card key={idea.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                      {idea.title}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant="secondary" className="text-[10px]">
                      {formatCategory(idea.category)}
                    </Badge>
                    <span className="text-gray-400">
                      {idea.priorityScore.toFixed(0)} pts
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {formatRelativeTime(idea.discoveredAt)}
                    {idea.discoverySource
                      ? ` \u00b7 ${idea.discoverySource}`
                      : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Category Breakdown Chart */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Category Breakdown
          </h2>
        </div>
        {chartData.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-400 text-center">
              No category data available
            </p>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ideas by Category</CardTitle>
              <CardDescription>
                Distribution of discovered ideas across product categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name: any) => {
                        if (name === "count") return [String(value), "Ideas"];
                        return [String(value), "Avg Score"];
                      }) as any}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend / Stats List */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                {data.topCategories.map((cat, idx) => (
                  <div
                    key={cat.category}
                    className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {formatCategory(cat.category)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {cat._count.id} ideas &middot; avg{" "}
                        {Math.round(cat._avg.priorityScore ?? 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
