"use client";

import React, { useMemo } from "react";
import type { IdeaDetail } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  MessageCircle,
  Video,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MarketDataTabProps {
  idea: IdeaDetail;
}

// Generate mock trend data based on the current trend score
function generateMockTrendData(trendScore: number | null) {
  const base = trendScore ?? 50;
  const months = [
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  ];

  return months.map((month, i) => {
    // Create a gradually rising trend with some noise
    const progress = i / (months.length - 1);
    const noise = Math.round((Math.random() - 0.5) * 15);
    const startValue = Math.max(10, base - 25 + Math.round(Math.random() * 10));
    const value = Math.min(
      100,
      Math.max(5, Math.round(startValue + (base - startValue) * progress + noise))
    );
    return { month, value };
  });
}

export function MarketDataTab({ idea }: MarketDataTabProps) {
  const trendData = useMemo(
    () => generateMockTrendData(idea.googleTrendsScore),
    [idea.googleTrendsScore]
  );

  interface MetricItem {
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    iconBg: string;
    label: string;
    value: string | number;
    subtext: string | null;
    badge?: { text: string; className: string } | null;
    extra?: string | null;
  }

  const metrics: MetricItem[] = [
    {
      icon: TrendingUp,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      label: "Google Trends Score",
      value: idea.googleTrendsScore ?? "--",
      subtext: idea.googleTrendsDirection
        ? `Direction: ${idea.googleTrendsDirection}`
        : null,
      badge: idea.googleTrendsDirection === "rising"
        ? { text: "Rising", className: "bg-green-100 text-green-700" }
        : idea.googleTrendsDirection === "declining"
          ? { text: "Declining", className: "bg-red-100 text-red-700" }
          : null,
    },
    {
      icon: MessageCircle,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
      label: "Reddit Mentions",
      value: idea.redditMentionCount,
      subtext: idea.redditQuestionCount > 0
        ? `${idea.redditQuestionCount} questions found`
        : null,
    },
    {
      icon: Video,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      label: "YouTube Videos",
      value: idea.youtubeVideoCount,
      subtext: idea.youtubeAvgViews > 0
        ? `Avg views: ${idea.youtubeAvgViews.toLocaleString()}`
        : null,
    },
    {
      icon: Search,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      label: "Monthly Search Volume",
      value: idea.searchVolumeMonthly
        ? idea.searchVolumeMonthly.toLocaleString()
        : "--",
      subtext: null,
    },
    {
      icon: ShoppingBag,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      label: "Etsy Competitors",
      value: idea.etsyCompetitorCount,
      subtext: idea.etsyAvgPrice
        ? `Avg price: ${idea.etsyAvgPrice}`
        : null,
      extra: idea.etsyAvgReviews
        ? `Avg reviews: ${idea.etsyAvgReviews}`
        : null,
    },
    {
      icon: Store,
      iconColor: "text-pink-600",
      iconBg: "bg-pink-50",
      label: "Whop Competitors",
      value: idea.whopCompetitorCount,
      subtext: null,
    },
  ];

  return (
    <div className="space-y-6 mt-4">
      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Google Trends (12 months)
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              Simulated trend data
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                    fontSize: "13px",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any) => [String(value), "Interest"]) as any}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#trendGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#7c3aed" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg ${metric.iconBg} flex items-center justify-center shrink-0`}
              >
                <metric.icon className={`w-5 h-5 ${metric.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">{metric.label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-bold text-gray-900">
                    {metric.value}
                  </span>
                  {metric.badge && (
                    <Badge
                      className={`text-[10px] border-0 ${metric.badge.className}`}
                    >
                      {metric.badge.text}
                    </Badge>
                  )}
                </div>
                {metric.subtext && (
                  <p className="text-xs text-gray-400 mt-1">{metric.subtext}</p>
                )}
                {metric.extra && (
                  <p className="text-xs text-gray-400">{metric.extra}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Forum mentions */}
      {idea.forumMentionCount > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">
                {idea.forumMentionCount}
              </span>{" "}
              additional forum mentions detected across other platforms
            </span>
          </div>
        </Card>
      )}

      {/* Last data refresh */}
      {idea.lastDataRefresh && (
        <p className="text-xs text-gray-400 text-right">
          Data last refreshed: {new Date(idea.lastDataRefresh).toLocaleString()}
        </p>
      )}
    </div>
  );
}
