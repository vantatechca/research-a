"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/utils";

const CATEGORIES = [
  "ebook",
  "course",
  "template",
  "calculator",
  "app",
  "membership",
  "printable",
  "ai_tool",
] as const;

const EFFORT_LEVELS = ["low", "medium", "high"] as const;

interface AddIdeaDialogProps {
  /** Called after a successful create so the parent can refresh its list. */
  onCreated?: () => void;
  /** Optional className for the trigger button (so callers can position it). */
  className?: string;
}

export function AddIdeaDialog({ onCreated, className }: AddIdeaDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<string>("ebook");
  const [peptideTopics, setPeptideTopics] = useState("");
  const [detailedAnalysis, setDetailedAnalysis] = useState("");
  const [effortToBuild, setEffortToBuild] = useState<string>("medium");
  const [estimatedPriceRange, setEstimatedPriceRange] = useState("");

  function reset() {
    setTitle("");
    setSummary("");
    setCategory("ebook");
    setPeptideTopics("");
    setDetailedAnalysis("");
    setEffortToBuild("medium");
    setEstimatedPriceRange("");
    setError(null);
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    const trimmedSummary = summary.trim();

    if (!trimmedTitle || !trimmedSummary || !category) {
      setError("Title, summary, and category are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const topics = peptideTopics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          slug: slugify(trimmedTitle),
          summary: trimmedSummary,
          detailedAnalysis: detailedAnalysis.trim() || undefined,
          category,
          peptideTopics: topics,
          status: "pending",
          priorityScore: 50,
          confidenceScore: 0.5,
          effortToBuild,
          estimatedPriceRange: estimatedPriceRange.trim() || undefined,
          discoverySource: "manual",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      close();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create idea");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add Idea
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add New Idea</h2>
              <button
                type="button"
                onClick={close}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                disabled={submitting}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="add-idea-title"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  id="add-idea-title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. BPC-157 Reconstitution Calculator"
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="add-idea-summary"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="add-idea-summary"
                  name="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="One or two sentences describing the idea"
                  disabled={submitting}
                  required
                  rows={2}
                  className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="add-idea-category"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="add-idea-category"
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={submitting}
                    required
                    className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="add-idea-effort"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    Effort to build
                  </label>
                  <select
                    id="add-idea-effort"
                    name="effortToBuild"
                    value={effortToBuild}
                    onChange={(e) => setEffortToBuild(e.target.value)}
                    disabled={submitting}
                    className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
                  >
                    {EFFORT_LEVELS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="add-idea-topics"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Peptide topics{" "}
                  <span className="text-gray-400">(comma-separated)</span>
                </label>
                <Input
                  id="add-idea-topics"
                  name="peptideTopics"
                  value={peptideTopics}
                  onChange={(e) => setPeptideTopics(e.target.value)}
                  placeholder="e.g. BPC-157, TB-500, healing"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="add-idea-price"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Estimated price range
                </label>
                <Input
                  id="add-idea-price"
                  name="estimatedPriceRange"
                  value={estimatedPriceRange}
                  onChange={(e) => setEstimatedPriceRange(e.target.value)}
                  placeholder="e.g. $19-$49"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="add-idea-analysis"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Detailed analysis
                </label>
                <textarea
                  id="add-idea-analysis"
                  name="detailedAnalysis"
                  value={detailedAnalysis}
                  onChange={(e) => setDetailedAnalysis(e.target.value)}
                  placeholder="Why this idea? Who is it for? Key differentiators..."
                  disabled={submitting}
                  rows={3}
                  className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create Idea"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}