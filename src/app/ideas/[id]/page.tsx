"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn, getStatusColor, formatRelativeTime } from "@/lib/utils";
import type { IdeaDetail, IdeaStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority-badge";
import { OverviewTab } from "@/components/ideas/overview-tab";
import { MarketDataTab } from "@/components/ideas/market-data-tab";
import { CompetitorsTab } from "@/components/ideas/competitors-tab";
import { EvidenceTab } from "@/components/ideas/evidence-tab";
import { DiscussionTab } from "@/components/ideas/discussion-tab";
import {
  ArrowLeft,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Rocket,
  Shield,
  TrendingUp,
  Target,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: IdeaStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "launched", label: "Launched" },
];

const CATEGORY_STYLES: Record<string, string> = {
  ebook: "bg-amber-100 text-amber-800 border-amber-200",
  course: "bg-blue-100 text-blue-800 border-blue-200",
  template: "bg-emerald-100 text-emerald-800 border-emerald-200",
  calculator: "bg-cyan-100 text-cyan-800 border-cyan-200",
  app: "bg-violet-100 text-violet-800 border-violet-200",
  membership: "bg-pink-100 text-pink-800 border-pink-200",
  printable: "bg-orange-100 text-orange-800 border-orange-200",
  ai_tool: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

function getCategoryStyle(category: string): string {
  return CATEGORY_STYLES[category] || "bg-gray-100 text-gray-800 border-gray-200";
}

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function IdeaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ideaId = params.id;

  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Bottom bar state
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  // Modal state
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchIdea = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ideas/${ideaId}`);
      if (!res.ok) throw new Error("Idea not found");
      const data = await res.json();

      // Normalize JSON fields
      const normalized: IdeaDetail = {
        ...data,
        peptideTopics: Array.isArray(data.peptideTopics)
          ? data.peptideTopics
          : typeof data.peptideTopics === "string"
            ? JSON.parse(data.peptideTopics)
            : [],
        existingProducts: Array.isArray(data.existingProducts)
          ? data.existingProducts
          : typeof data.existingProducts === "string"
            ? JSON.parse(data.existingProducts)
            : [],
        sourceLinks: Array.isArray(data.sourceLinks)
          ? data.sourceLinks
          : typeof data.sourceLinks === "string"
            ? JSON.parse(data.sourceLinks)
            : [],
        operatorNotes: Array.isArray(data.operatorNotes)
          ? data.operatorNotes
          : typeof data.operatorNotes === "string"
            ? JSON.parse(data.operatorNotes)
            : [],
      };
      setIdea(normalized);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load idea");
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchIdea();
  }, [fetchIdea]);

  async function handleStatusChange(newStatus: string) {
    if (!idea || newStatus === idea.status) return;

    if (newStatus === "approved" && idea.status === "pending") {
      setApproveOpen(true);
      return;
    }

    setStatusChanging(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      setIdea((prev) => prev ? { ...prev, ...updated, status: newStatus } : prev);
      toast.success(`Status updated to ${formatStatus(newStatus)}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setStatusChanging(false);
    }
  }

  async function handleAddNote() {
    if (!noteInput.trim() || !idea) return;

    setSavingNote(true);
    try {
      const updatedNotes = [...idea.operatorNotes, `[NOTE] ${noteInput.trim()}`];
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatorNotes: updatedNotes }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setIdea((prev) =>
        prev ? { ...prev, operatorNotes: updatedNotes } : prev
      );
      setNoteInput("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleApprove() {
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: approveNotes }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      const updated = await res.json();
      setIdea((prev) => prev ? { ...prev, ...updated, status: "approved" } : prev);
      setApproveOpen(false);
      setApproveNotes("");
      toast.success("Idea approved");
    } catch {
      toast.error("Failed to approve idea");
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleDecline() {
    if (!declineReason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (!res.ok) throw new Error("Failed to decline");
      const updated = await res.json();
      setIdea((prev) => prev ? { ...prev, ...updated, status: "declined" } : prev);
      setDeclineOpen(false);
      setDeclineReason("");
      toast.success("Idea declined");
    } catch {
      toast.error("Failed to decline idea");
    } finally {
      setSubmittingAction(false);
    }
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading idea...</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error || !idea) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {error || "Idea not found"}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            The idea you are looking for may have been removed or does not exist.
          </p>
          <Button variant="outline" onClick={() => router.push("/ideas")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Ideas
          </Button>
        </Card>
      </div>
    );
  }

  const confidencePercent = idea.confidenceScore > 1
    ? Math.round(idea.confidenceScore)
    : Math.round(idea.confidenceScore * 100);

  return (
    <div className="pb-24">
      {/* Header / Back nav */}
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <Link
          href="/ideas"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Ideas
        </Link>
      </div>

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-8">
          {/* Title row */}
          <div className="flex items-start justify-between gap-6 mb-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                    getCategoryStyle(idea.category)
                  )}
                >
                  {formatCategory(idea.category)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    getStatusColor(idea.status)
                  )}
                >
                  {formatStatus(idea.status)}
                </span>
                {idea.discoveredAt && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(idea.discoveredAt)}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {idea.title}
              </h1>
              {idea.summary && (
                <p className="text-gray-500 mt-2 text-sm leading-relaxed max-w-3xl">
                  {idea.summary}
                </p>
              )}
            </div>

            {/* Action buttons (top right) */}
            <div className="flex items-center gap-2 shrink-0">
              {idea.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApproveOpen(true)}
                    className="text-green-700 border-green-200 hover:bg-green-50"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeclineOpen(true)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Decline
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Score cards row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Priority Score */}
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Priority</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-gray-900">
                    {idea.priorityScore.toFixed(0)}
                  </span>
                  <PriorityBadge score={idea.priorityScore} />
                </div>
              </div>
            </Card>

            {/* Confidence Score */}
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Confidence</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-gray-900">
                    {confidencePercent}%
                  </span>
                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        confidencePercent >= 70
                          ? "bg-green-500"
                          : confidencePercent >= 40
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      )}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Google Trends */}
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Trend Score</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-gray-900">
                    {idea.googleTrendsScore ?? "--"}
                  </span>
                  {idea.googleTrendsDirection && (
                    <Badge variant="secondary" className="text-[10px]">
                      {idea.googleTrendsDirection}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Effort */}
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Rocket className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Build Effort</p>
                <span className="text-lg font-semibold text-gray-900">
                  {idea.effortToBuild ?? "Unknown"}
                </span>
              </div>
            </Card>
          </div>

          {/* Peptide topic tags */}
          {idea.peptideTopics.length > 0 && (
            <div className="flex items-center gap-2 mt-5 flex-wrap">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider mr-1">
                Topics
              </span>
              {idea.peptideTopics.map((topic) => (
                <Badge
                  key={topic}
                  variant="outline"
                  className="text-xs bg-gray-50 text-gray-600 border-gray-200"
                >
                  {topic}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Section */}
      <div className="px-8 pt-6">
        <TabsRoot value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="market">Market Data</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="discussion">Discussion</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab idea={idea} />
          </TabsContent>

          <TabsContent value="market">
            <MarketDataTab idea={idea} />
          </TabsContent>

          <TabsContent value="competitors">
            <CompetitorsTab idea={idea} />
          </TabsContent>

          <TabsContent value="evidence">
            <EvidenceTab idea={idea} />
          </TabsContent>

          <TabsContent value="discussion">
            <DiscussionTab ideaId={idea.id} ideaTitle={idea.title} />
          </TabsContent>

          <TabsContent value="notes">
            <NotesTab idea={idea} />
          </TabsContent>
        </TabsRoot>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-64 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="px-8 py-3 flex items-center gap-4">
          {/* Status selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500 font-medium">Status:</span>
            <Select
              value={idea.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger
                className="w-40 h-8 text-xs"
                disabled={statusChanging}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note input */}
          <div className="flex-1 flex items-center gap-2">
            <Input
              id="idea-quick-note"
              name="quickNote"
              autoComplete="off"
              placeholder="Add a quick note..."
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              className="h-8 text-sm"
              disabled={savingNote}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddNote}
              disabled={!noteInput.trim() || savingNote}
            >
              {savingNote ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          {/* Deep Dive button */}
          <Button
            size="sm"
            onClick={() => setActiveTab("discussion")}
            className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Deep Dive
          </Button>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Idea</DialogTitle>
            <DialogDescription>
              Approving will move this idea into the active pipeline. Add optional notes to record your reasoning.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              id="idea-approve-notes"
              name="approveNotes"
              autoComplete="off"
              placeholder="Why are you approving this idea? What makes it promising? (optional)"
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveOpen(false)}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={submittingAction}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {submittingAction ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Idea</DialogTitle>
            <DialogDescription>
              Declining will archive this idea. A reason is required so the AI Brain can learn from this decision.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              id="idea-decline-reason"
              name="declineReason"
              autoComplete="off"
              placeholder="Why are you declining this idea? (required)"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={submittingAction || !declineReason.trim()}
            >
              {submittingAction ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-1" />
              )}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================================
   Notes Tab (inline, small enough to co-locate)
   ============================================ */

function NotesTab({ idea }: { idea: IdeaDetail }) {
  if (idea.operatorNotes.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-gray-500">No operator notes yet. Use the bar below to add one.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {idea.operatorNotes.map((note, i) => {
        const isApprove = note.startsWith("[APPROVED]");
        const isDecline = note.startsWith("[DECLINED]");
        const isNote = note.startsWith("[NOTE]");

        return (
          <Card key={i} className="p-4 flex items-start gap-3">
            <div
              className={cn(
                "w-2 h-2 rounded-full mt-1.5 shrink-0",
                isApprove
                  ? "bg-green-500"
                  : isDecline
                    ? "bg-red-500"
                    : isNote
                      ? "bg-blue-500"
                      : "bg-gray-400"
              )}
            />
            <p className="text-sm text-gray-700">{note}</p>
          </Card>
        );
      })}
    </div>
  );
}
