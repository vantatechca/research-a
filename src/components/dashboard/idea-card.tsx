"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/priority-badge";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import type { IdeaCard as IdeaCardType, IdeaCategory } from "@/types";
import {
  Check,
  X,
  MessageCircle,
  Pin,
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingBag,
  Store,
  MessageSquareText,
} from "lucide-react";

const CATEGORY_COLORS: Record<IdeaCategory, string> = {
  ebook: "bg-blue-100 text-blue-700 border-blue-200",
  course: "bg-purple-100 text-purple-700 border-purple-200",
  template: "bg-teal-100 text-teal-700 border-teal-200",
  calculator: "bg-orange-100 text-orange-700 border-orange-200",
  app: "bg-pink-100 text-pink-700 border-pink-200",
  membership: "bg-green-100 text-green-700 border-green-200",
  printable: "bg-amber-100 text-amber-700 border-amber-200",
  ai_tool: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

interface IdeaCardProps {
  idea: IdeaCardType;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function IdeaCard({ idea, onStatusChange }: IdeaCardProps) {
  const router = useRouter();
  const [isActing, setIsActing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const categoryColor =
    CATEGORY_COLORS[idea.category as IdeaCategory] ||
    "bg-gray-100 text-gray-700 border-gray-200";

  const trendDirection = idea.googleTrendsDirection;

  async function handleApprove(e: React.MouseEvent) {
    e.stopPropagation();
    setIsActing(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "" }),
      });
      if (res.ok) {
        onStatusChange?.(idea.id, "approved");
      }
    } catch {
      // silently fail, toast could be added
    } finally {
      setIsActing(false);
    }
  }

  async function handleDecline(e: React.MouseEvent) {
    e.stopPropagation();
    setIsActing(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Declined from dashboard" }),
      });
      if (res.ok) {
        onStatusChange?.(idea.id, "declined");
      }
    } catch {
      // silently fail
    } finally {
      setIsActing(false);
    }
  }

  function handleDiscuss(e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/brain?idea=${idea.id}`);
  }

  function handlePin(e: React.MouseEvent) {
    e.stopPropagation();
    setIsPinned((prev) => !prev);
  }

  function handleCardClick() {
    router.push(`/ideas/${idea.id}`);
  }

  return (
    <Card
      className="group relative p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Top row: category badge + priority score */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0",
              categoryColor
            )}
          >
            {idea.category.replace("_", " ")}
          </span>
          {idea.status !== "pending" && (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
                idea.status === "approved" && "bg-blue-50 text-blue-600",
                idea.status === "in_progress" && "bg-purple-50 text-purple-600",
                idea.status === "launched" && "bg-green-50 text-green-600",
                idea.status === "declined" && "bg-red-50 text-red-600"
              )}
            >
              {idea.status.replace("_", " ")}
            </span>
          )}
        </div>
        <PriorityBadge score={idea.priorityScore} />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1 group-hover:text-violet-700 transition-colors">
        {idea.title}
      </h3>

      {/* Summary (2 lines) */}
      <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">
        {truncate(idea.summary, 160)}
      </p>

      {/* Metrics row */}
      <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
        {/* Reddit mentions */}
        <div className="flex items-center gap-1">
          <MessageSquareText className="w-3.5 h-3.5" />
          <span className="font-medium text-gray-600">
            {idea.redditMentionCount}
          </span>
          {trendDirection === "rising" && (
            <TrendingUp className="w-3 h-3 text-green-500" />
          )}
          {trendDirection === "declining" && (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          {trendDirection === "stable" && (
            <Minus className="w-3 h-3 text-gray-400" />
          )}
        </div>

        {/* Etsy competitors */}
        <div className="flex items-center gap-1">
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="font-medium text-gray-600">
            {idea.etsyCompetitorCount}
          </span>
          <span className="text-gray-400">Etsy</span>
        </div>

        {/* Whop competitors */}
        <div className="flex items-center gap-1">
          <Store className="w-3.5 h-3.5" />
          <span className="font-medium text-gray-600">
            {idea.whopCompetitorCount}
          </span>
          <span className="text-gray-400">Whop</span>
        </div>

        {/* Discovery time */}
        <span className="ml-auto text-gray-400">
          {formatRelativeTime(idea.discoveredAt)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
        {idea.status === "pending" && (
          <>
            <Button
              variant="ghost"
              size="xs"
              disabled={isActing}
              onClick={handleApprove}
              className="text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              <Check className="w-3.5 h-3.5" data-icon="inline-start" />
              Approve
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={isActing}
              onClick={handleDecline}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="w-3.5 h-3.5" data-icon="inline-start" />
              Decline
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="xs"
          onClick={handleDiscuss}
          className="text-gray-500 hover:text-violet-600"
        >
          <MessageCircle className="w-3.5 h-3.5" data-icon="inline-start" />
          Discuss
        </Button>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handlePin}
            className={cn(
              "text-gray-400 hover:text-amber-500",
              isPinned && "text-amber-500"
            )}
          >
            <Pin
              className={cn("w-3.5 h-3.5", isPinned && "fill-amber-500")}
            />
          </Button>
        </div>
      </div>
    </Card>
  );
}
