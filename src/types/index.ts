export interface IdeaCard {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  subcategory: string | null;
  peptideTopics: string[];
  status: string;
  priorityScore: number;
  confidenceScore: number;
  googleTrendsScore: number | null;
  googleTrendsDirection: string | null;
  redditMentionCount: number;
  etsyCompetitorCount: number;
  whopCompetitorCount: number;
  estimatedPriceRange: string | null;
  effortToBuild: string | null;
  discoveredAt: string;
}

export interface IdeaDetail extends IdeaCard {
  detailedAnalysis: string | null;
  redditQuestionCount: number;
  youtubeVideoCount: number;
  youtubeAvgViews: number;
  forumMentionCount: number;
  etsyAvgPrice: string | null;
  etsyAvgReviews: number | null;
  searchVolumeMonthly: number | null;
  existingProducts: ExistingProduct[];
  competitorAnalysis: string | null;
  differentiationNotes: string | null;
  estimatedMonthlyRev: string | null;
  timeToBuild: string | null;
  sourceLinks: SourceLink[];
  discoverySource: string | null;
  operatorNotes: string[];
  declineReason: string | null;
  approvalNotes: string | null;
  lastDataRefresh: string | null;
  statusChangedAt: string | null;
}

export interface ExistingProduct {
  url: string;
  title: string;
  platform: string;
  price?: string;
  reviews?: number;
  rating?: number;
}

export interface SourceLink {
  url: string;
  title: string;
  sourceType: string;
  snippet?: string;
}

export interface BrainMemoryItem {
  id: string;
  memoryType: string;
  content: string;
  source: string | null;
  importance: number;
  active: boolean;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  relatedIdeaId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PipelineStats {
  totalIdeas: number;
  pendingIdeas: number;
  approvedIdeas: number;
  declinedIdeas: number;
  launchedIdeas: number;
  inProgressIdeas: number;
  todayDiscoveries: number;
  totalMemories: number;
  goldenRules: number;
  recentScrapes: number;
  topTrendingTopic: string | null;
}

export interface MonitoredSourceItem {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  sourceName: string;
  checkFreqHours: number;
  lastCheckedAt: string | null;
  active: boolean;
}

export type IdeaStatus = "pending" | "approved" | "declined" | "in_progress" | "launched";
export type IdeaCategory = "ebook" | "course" | "template" | "calculator" | "app" | "membership" | "printable" | "ai_tool";
export type MemoryType = "golden_rule" | "general_rule" | "preference" | "conversation_insight" | "operator_note";
