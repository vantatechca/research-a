"use client";

import React from "react";
import type { IdeaDetail, SourceLink } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  MessageCircle,
  Video,
  Globe,
  Newspaper,
  Link as LinkIcon,
  FileSearch,
} from "lucide-react";

interface EvidenceTabProps {
  idea: IdeaDetail;
}

type SourceCategory = {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  links: SourceLink[];
};

function categorizeSourceType(sourceType: string): string {
  const t = sourceType.toLowerCase();
  if (t.includes("reddit")) return "reddit";
  if (t.includes("youtube") || t.includes("video")) return "youtube";
  if (t.includes("forum") || t.includes("community") || t.includes("quora"))
    return "forum";
  if (t.includes("news") || t.includes("article") || t.includes("blog"))
    return "news";
  return "other";
}

const SOURCE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    iconBg: string;
  }
> = {
  reddit: {
    label: "Reddit",
    icon: MessageCircle,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
  },
  youtube: {
    label: "YouTube",
    icon: Video,
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
  },
  forum: {
    label: "Forums & Communities",
    icon: Globe,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  news: {
    label: "News & Articles",
    icon: Newspaper,
    iconColor: "text-green-600",
    iconBg: "bg-green-50",
  },
  other: {
    label: "Other Sources",
    icon: LinkIcon,
    iconColor: "text-gray-600",
    iconBg: "bg-gray-50",
  },
};

export function EvidenceTab({ idea }: EvidenceTabProps) {
  const links = idea.sourceLinks ?? [];

  if (links.length === 0) {
    return (
      <Card className="p-8 text-center mt-4">
        <FileSearch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          No source evidence collected yet. Evidence links will appear here as the system discovers supporting data.
        </p>
      </Card>
    );
  }

  // Group by category
  const grouped: Record<string, SourceLink[]> = {};
  for (const link of links) {
    const cat = categorizeSourceType(link.sourceType);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(link);
  }

  const categories: SourceCategory[] = Object.entries(grouped)
    .map(([type, categoryLinks]) => ({
      type,
      ...SOURCE_CONFIG[type],
      links: categoryLinks,
    }))
    .sort((a, b) => b.links.length - a.links.length);

  return (
    <div className="space-y-6 mt-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500">
          <span className="font-medium text-gray-800">{links.length}</span> sources found
        </span>
        <span className="text-gray-300">|</span>
        {categories.map((cat) => (
          <Badge key={cat.type} variant="secondary" className="text-xs gap-1">
            <cat.icon className={`w-3 h-3 ${cat.iconColor}`} />
            {cat.label}: {cat.links.length}
          </Badge>
        ))}
      </div>

      {/* Source sections */}
      {categories.map((category) => (
        <Card key={category.type}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div
                className={`w-7 h-7 rounded-md ${category.iconBg} flex items-center justify-center`}
              >
                <category.icon className={`w-4 h-4 ${category.iconColor}`} />
              </div>
              {category.label}
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {category.links.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {category.links.map((link, i) => (
              <div
                key={i}
                className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors -mx-2"
              >
                <div className="shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-gray-300 group-hover:bg-violet-500 transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium text-gray-900 leading-snug">
                      {link.title}
                    </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-violet-600 transition-colors shrink-0 mt-0.5"
                      title="Open source link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  {link.snippet && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {link.snippet}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] text-gray-400">
                      {link.sourceType}
                    </Badge>
                    <span className="text-[10px] text-gray-400 truncate max-w-xs">
                      {link.url}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Discovery source */}
      {idea.discoverySource && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FileSearch className="w-3.5 h-3.5" />
            <span>
              Originally discovered via:{" "}
              <span className="font-medium text-gray-700">
                {idea.discoverySource}
              </span>
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
