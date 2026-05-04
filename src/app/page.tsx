"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AddIdeaDialog } from "@/components/dashboard/add-idea-dialog";
import { StatCard } from "@/components/stat-card";
import { IdeaCard } from "@/components/dashboard/idea-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { IdeaCard as IdeaCardType, PipelineStats, BrainMemoryItem } from "@/types";
import {
  Lightbulb,
  Clock,
  CheckCircle2,
  Rocket,
  Construction,
  TrendingUp,
  Brain,
  MessageCircle,
  Activity,
  Sparkles,
  Loader2,
  Inbox,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [ideas, setIdeas] = useState<IdeaCardType[]>([]);
  const [memories, setMemories] = useState<BrainMemoryItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [loadingMemories, setLoadingMemories] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // failed to load stats
      } finally {
        setLoadingStats(false);
      }
    }

    async function fetchIdeas() {
      try {
        const res = await fetch(
          "/api/ideas?status=pending&sort=discovered_at&limit=20"
        );
        if (res.ok) {
          const data = await res.json();
          setIdeas(data.ideas);
        }
      } catch {
        // failed to load ideas
      } finally {
        setLoadingIdeas(false);
      }
    }

    async function fetchMemories() {
      try {
        const res = await fetch("/api/brain/memory?active=true");
        if (res.ok) {
          const data: BrainMemoryItem[] = await res.json();
          setMemories(data.slice(0, 5));
        }
      } catch {
        // failed to load memories
      } finally {
        setLoadingMemories(false);
      }
    }

    fetchStats();
    fetchIdeas();
    fetchMemories();
  }, []);

  function handleIdeaStatusChange(id: string, newStatus: string) {
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, status: newStatus } : idea
      )
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your peptide research command center</p>
        </div>
        <AddIdeaDialog onCreated={() => window.location.reload()} />
      </div>

      {/* Stats row */}
      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-7 w-12 bg-gray-200 rounded" />
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard
            title="Total Ideas"
            value={stats.totalIdeas}
            subtitle={`${stats.todayDiscoveries} today`}
            className="border-l-2 border-l-violet-400"
          />
          <StatCard
            title="Pending"
            value={stats.pendingIdeas}
            trend={stats.pendingIdeas > 10 ? "up" : "stable"}
            className="border-l-2 border-l-gray-400"
          />
          <StatCard
            title="Approved"
            value={stats.approvedIdeas}
            trend="up"
            className="border-l-2 border-l-blue-400"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgressIdeas}
            className="border-l-2 border-l-purple-400"
          />
          <StatCard
            title="Launched"
            value={stats.launchedIdeas}
            trend={stats.launchedIdeas > 0 ? "up" : "stable"}
            className="border-l-2 border-l-green-400"
          />
          <StatCard
            title="Top Trending"
            value={stats.topTrendingTopic || "--"}
            trend="up"
            className="border-l-2 border-l-orange-400"
          />
        </div>
      ) : (
        <div className="mb-8 p-4 text-center text-sm text-gray-400">
          Failed to load statistics
        </div>
      )}

      {/* Two-column layout: feed + brain panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Today's Discoveries feed (~2/3) */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Today&apos;s Discoveries
              </h2>
              {!loadingIdeas && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {ideas.length}
                </span>
              )}
            </div>
            <Link href="/ideas">
              <Button variant="ghost" size="sm" className="text-violet-600">
                View All
              </Button>
            </Link>
          </div>

          {loadingIdeas ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">
                Loading ideas...
              </span>
            </div>
          ) : ideas.length === 0 ? (
            <Card className="p-8 text-center">
              <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">
                No pending ideas found
              </p>
              <p className="text-xs text-gray-400 mt-1">
                New ideas will appear here as they are discovered
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onStatusChange={handleIdeaStatusChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right column: Brain Activity panel (~1/3) */}
        <div className="space-y-4">
          {/* Brain Activity header card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-br from-violet-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-violet-600" />
                <CardTitle className="text-base">Brain Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Quick chat link */}
              <Link href="/brain">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 hover:bg-violet-100 transition-colors mb-4 cursor-pointer">
                  <MessageCircle className="w-5 h-5 text-violet-600" />
                  <div>
                    <p className="text-sm font-medium text-violet-900">
                      Chat with Brain
                    </p>
                    <p className="text-xs text-violet-600">
                      Ask about trends, get ideas reviewed
                    </p>
                  </div>
                </div>
              </Link>

              {/* Research pulse */}
              <div className="flex items-center gap-2 mb-4 px-1">
                <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-xs text-gray-600">Research Pulse</span>
                <span className="ml-auto text-xs font-semibold text-green-600">
                  Active
                </span>
              </div>

              {/* Stats mini row */}
              {stats && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-gray-800">
                      {stats.totalMemories}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Memories
                    </p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-gray-800">
                      {stats.goldenRules}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Golden Rules
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Learnings */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm">Recent Learnings</CardTitle>
                </div>
                <Link href="/brain">
                  <Button variant="ghost" size="xs" className="text-xs text-gray-400">
                    See all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {loadingMemories ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-3 w-full bg-gray-100 rounded mb-1" />
                      <div className="h-3 w-2/3 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : memories.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No learnings yet. The brain will store insights as you review
                  ideas.
                </p>
              ) : (
                <div className="space-y-3">
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="group/memory text-xs border-l-2 border-violet-200 pl-3 py-1"
                    >
                      <p className="text-gray-700 leading-relaxed line-clamp-2">
                        {memory.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">
                          {formatRelativeTime(memory.createdAt)}
                        </span>
                        <span className="text-[10px] text-violet-400 font-medium">
                          {memory.memoryType.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Quick Actions
            </p>
            <div className="space-y-2">
              <Link href="/ideas" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <Lightbulb className="w-4 h-4 text-gray-400" />
                  Browse All Ideas
                </Button>
              </Link>
              <Link href="/trends" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  View Trends
                </Button>
              </Link>
              <Link href="/brain" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <Brain className="w-4 h-4 text-gray-400" />
                  Open Brain Chat
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
