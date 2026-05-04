"use client";

import { useState, useEffect, useCallback } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type {
  MonitoredSourceItem,
  BrainMemoryItem,
  PipelineStats,
  MemoryType,
} from "@/types";
import {
  Globe,
  Brain,
  Key,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Shield,
  BookOpen,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Star,
  Zap,
} from "lucide-react";

// ──────────────────────────── Sources Tab ────────────────────────────

function SourcesTab() {
  const [sources, setSources] = useState<MonitoredSourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSource, setNewSource] = useState({
    sourceType: "reddit",
    sourceName: "",
    sourceUrl: "",
    checkFreqHours: 4,
  });

  const fetchSources = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/settings/sources");
      if (!res.ok) throw new Error("Failed to fetch sources");
      const data: MonitoredSourceItem[] = await res.json();
      setSources(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  async function handleAddSource() {
    if (!newSource.sourceName.trim()) return;
    try {
      const res = await fetch("/api/settings/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });
      if (!res.ok) throw new Error("Failed to add source");
      setShowAddForm(false);
      setNewSource({ sourceType: "reddit", sourceName: "", sourceUrl: "", checkFreqHours: 4 });
      fetchSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add source");
    }
  }

  async function handleToggleActive(source: MonitoredSourceItem) {
    try {
      await fetch("/api/settings/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: source.id, active: !source.active }),
      });
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? { ...s, active: !s.active } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update source");
    }
  }

  async function handleUpdateFrequency(id: string, checkFreqHours: number) {
    try {
      await fetch("/api/settings/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checkFreqHours }),
      });
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, checkFreqHours } : s))
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update frequency");
    }
  }

  async function handleDeleteSource(id: string) {
    try {
      await fetch(`/api/settings/sources?id=${id}`, { method: "DELETE" });
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete source");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Monitored Sources</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure which data sources the scraper monitors
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Source
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Source Type
                </label>
                <Select
                  value={newSource.sourceType}
                  onValueChange={(val) =>
                    setNewSource((p) => ({ ...p, sourceType: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="google_trends">Google Trends</SelectItem>
                    <SelectItem value="etsy">Etsy</SelectItem>
                    <SelectItem value="forum">Forum</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Check Frequency (hours)
                </label>
                <Input
                  id="new-source-freq"
                  name="checkFreqHours"
                  autoComplete="off"
                  type="number"
                  min={1}
                  max={168}
                  value={newSource.checkFreqHours}
                  onChange={(e) =>
                    setNewSource((p) => ({
                      ...p,
                      checkFreqHours: parseInt(e.target.value) || 4,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Source Name
              </label>
              <Input
                id="new-source-name"
                name="sourceName"
                autoComplete="off"
                placeholder="e.g. r/Peptides"
                value={newSource.sourceName}
                onChange={(e) =>
                  setNewSource((p) => ({ ...p, sourceName: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                URL (optional)
              </label>
              <Input
                id="new-source-url"
                name="sourceUrl"
                autoComplete="off"
                type="url"
                placeholder="https://..."
                value={newSource.sourceUrl}
                onChange={(e) =>
                  setNewSource((p) => ({ ...p, sourceUrl: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddSource}>
                <Plus className="w-4 h-4 mr-1" />
                Add Source
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sources.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Globe className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No sources configured yet</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <Card key={source.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={source.active}
                    onCheckedChange={() => handleToggleActive(source)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          source.active ? "text-gray-900" : "text-gray-400"
                        )}
                      >
                        {source.sourceName}
                      </p>
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase"
                      >
                        {source.sourceType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {source.sourceUrl || "No URL"}
                      {source.lastCheckedAt
                        ? ` \u00b7 Last checked ${formatRelativeTime(source.lastCheckedAt)}`
                        : " \u00b7 Never checked"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingId === source.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id={`source-freq-${source.id}`}
                          name="checkFreqHours"
                          autoComplete="off"
                          type="number"
                          min={1}
                          max={168}
                          className="w-20 h-8 text-xs"
                          defaultValue={source.checkFreqHours}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdateFrequency(
                                source.id,
                                parseInt((e.target as HTMLInputElement).value) || 4
                              );
                            }
                          }}
                          onBlur={(e) =>
                            handleUpdateFrequency(
                              source.id,
                              parseInt(e.target.value) || 4
                            )
                          }
                        />
                        <span className="text-xs text-gray-400">hrs</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingId(source.id)}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Every {source.checkFreqHours}h
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteSource(source.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── Rules Tab ────────────────────────────

function RulesTab() {
  const [rules, setRules] = useState<BrainMemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState<BrainMemoryItem | null>(null);
  const [newRule, setNewRule] = useState({
    memoryType: "general_rule" as MemoryType,
    content: "",
    importance: 0.5,
  });

  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/brain/memory?active=true");
      if (!res.ok) throw new Error("Failed to fetch rules");
      const data: BrainMemoryItem[] = await res.json();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleAddRule() {
    if (!newRule.content.trim()) return;
    try {
      const res = await fetch("/api/brain/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });
      if (!res.ok) throw new Error("Failed to add rule");
      setShowAddForm(false);
      setNewRule({ memoryType: "general_rule", content: "", importance: 0.5 });
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    }
  }

  async function handleUpdateRule() {
    if (!editingRule) return;
    try {
      await fetch("/api/brain/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRule.id,
          content: editingRule.content,
          importance: editingRule.importance,
          memoryType: editingRule.memoryType,
        }),
      });
      setEditingRule(null);
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rule");
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await fetch(`/api/brain/memory?id=${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const goldenRules = rules.filter((r) => r.memoryType === "golden_rule");
  const generalRules = rules.filter((r) => r.memoryType === "general_rule");
  const otherMemories = rules.filter(
    (r) => r.memoryType !== "golden_rule" && r.memoryType !== "general_rule"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Brain Memory & Rules</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure the rules and memories that guide PeptideBrain
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Rule Type
                </label>
                <Select
                  value={newRule.memoryType}
                  onValueChange={(val) =>
                    setNewRule((p) => ({ ...p, memoryType: val as MemoryType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="golden_rule">Golden Rule</SelectItem>
                    <SelectItem value="general_rule">General Rule</SelectItem>
                    <SelectItem value="preference">Preference</SelectItem>
                    <SelectItem value="operator_note">Operator Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Importance: {(newRule.importance * 100).toFixed(0)}%
                </label>
                <Slider
                  value={[newRule.importance * 100]}
                  onValueChange={([val]) =>
                    setNewRule((p) => ({ ...p, importance: val / 100 }))
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="mt-3"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Content
              </label>
              <Textarea
                id="new-rule-content"
                name="ruleContent"
                autoComplete="off"
                placeholder="Enter the rule or memory content..."
                value={newRule.content}
                onChange={(e) =>
                  setNewRule((p) => ({ ...p, content: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddRule}>
                <Plus className="w-4 h-4 mr-1" />
                Add Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
            <DialogDescription>
              Modify the rule content, type, or importance.
            </DialogDescription>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Rule Type
                </label>
                <Select
                  value={editingRule.memoryType}
                  onValueChange={(val) =>
                    setEditingRule({ ...editingRule, memoryType: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="golden_rule">Golden Rule</SelectItem>
                    <SelectItem value="general_rule">General Rule</SelectItem>
                    <SelectItem value="preference">Preference</SelectItem>
                    <SelectItem value="operator_note">Operator Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Importance: {(editingRule.importance * 100).toFixed(0)}%
                </label>
                <Slider
                  value={[editingRule.importance * 100]}
                  onValueChange={([val]) =>
                    setEditingRule({ ...editingRule, importance: val / 100 })
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="mt-3"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Content
                </label>
                <Textarea
                  id="edit-rule-content"
                  name="editRuleContent"
                  autoComplete="off"
                  value={editingRule.content}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, content: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRule}>
              <Save className="w-4 h-4 mr-1" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {goldenRules.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-gray-700">
              Golden Rules
            </h4>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {goldenRules.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {goldenRules.map((rule) => (
              <Card
                key={rule.id}
                className="border-amber-200 bg-amber-50/30"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{rule.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>
                          Importance: {(rule.importance * 100).toFixed(0)}%
                        </span>
                        <span>{formatRelativeTime(rule.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingRule(rule)}
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {generalRules.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <h4 className="text-sm font-semibold text-gray-700">
              General Rules
            </h4>
            <Badge variant="secondary">{generalRules.length}</Badge>
          </div>
          <div className="space-y-2">
            {generalRules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{rule.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>
                          Importance: {(rule.importance * 100).toFixed(0)}%
                        </span>
                        <span>{formatRelativeTime(rule.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingRule(rule)}
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {otherMemories.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-violet-500" />
            <h4 className="text-sm font-semibold text-gray-700">
              Other Memories
            </h4>
            <Badge variant="secondary">{otherMemories.length}</Badge>
          </div>
          <div className="space-y-2">
            {otherMemories.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase"
                        >
                          {rule.memoryType.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{rule.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>
                          Importance: {(rule.importance * 100).toFixed(0)}%
                        </span>
                        <span>{formatRelativeTime(rule.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingRule(rule)}
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {rules.length === 0 && (
        <Card className="p-8">
          <div className="text-center">
            <Brain className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No rules or memories configured</p>
            <p className="text-xs text-gray-400 mt-1">
              Add golden rules and general rules to guide PeptideBrain
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// ──────────────────────────── API Keys Tab ────────────────────────────

interface ProviderInfo {
  id: string;
  label: string;
  envVar: string;
  description: string;
  placeholder: string;
  patternHint: string | null;
  testable: boolean;
}

interface KeyStatus {
  provider: string;
  configured: boolean;
  source: "db" | "env" | "missing";
  preview: string;
  updatedAt: string | null;
}

interface KeysListResponse {
  providers: ProviderInfo[];
  keys: KeyStatus[];
  masterKeyConfigured: boolean;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "result"; ok: boolean; message: string };

function ApiKeysTab() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [statuses, setStatuses] = useState<Record<string, KeyStatus>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [masterKeyConfigured, setMasterKeyConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as KeysListResponse;
      setProviders(data.providers);
      setStatuses(
        Object.fromEntries(data.keys.map((k) => [k.provider, k]))
      );
      setMasterKeyConfigured(data.masterKeyConfigured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleVisibility(id: string) {
    setVisible((p) => ({ ...p, [id]: !p[id] }));
  }

  function setDraft(id: string, value: string) {
    setDrafts((p) => ({ ...p, [id]: value }));
    setTests((p) => ({ ...p, [id]: { status: "idle" } }));
  }

  async function handleSaveOne(id: string) {
    const value = drafts[id]?.trim();
    if (!value) return;

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: [{ provider: id, value }] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setSavedMessage(`Saved ${id}`);
      setTimeout(() => setSavedMessage(null), 3000);
      setDrafts((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAll() {
    const entries = Object.entries(drafts)
      .map(([provider, value]) => ({ provider, value: value.trim() }))
      .filter((e) => e.value.length > 0);

    if (entries.length === 0) {
      setSavedMessage("No changes to save");
      setTimeout(() => setSavedMessage(null), 2000);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: entries }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setSavedMessage(
        `Saved ${entries.length} key${entries.length === 1 ? "" : "s"}`
      );
      setTimeout(() => setSavedMessage(null), 3000);
      setDrafts({});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save keys");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        `Delete the saved key for ${id}? Env-var fallback (if any) will take over.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `/api/settings/api-keys?provider=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete key");
    }
  }

  async function handleTest(id: string) {
    const draftValue = drafts[id]?.trim();
    setTests((p) => ({ ...p, [id]: { status: "testing" } }));
    try {
      const body: Record<string, string> = { provider: id };
      if (draftValue && draftValue.length > 0) body.value = draftValue;

      const res = await fetch("/api/settings/api-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setTests((p) => ({
          ...p,
          [id]: {
            status: "result",
            ok: false,
            message: data.error ?? `HTTP ${res.status}`,
          },
        }));
        return;
      }
      setTests((p) => ({
        ...p,
        [id]: {
          status: "result",
          ok: data.ok ?? false,
          message: data.message ?? "",
        },
      }));
    } catch (e) {
      setTests((p) => ({
        ...p,
        [id]: {
          status: "result",
          ok: false,
          message: e instanceof Error ? e.message : "Network error",
        },
      }));
    }
  }

  const dirtyCount = Object.values(drafts).filter(
    (v) => v.trim().length > 0
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">API Keys</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Keys are encrypted with AES-256-GCM and stored in the database.
          Env-var fallback applies when no DB value is set.
        </p>
      </div>

      {!masterKeyConfigured && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">MASTER_ENCRYPTION_KEY is not set</div>
            <div className="text-xs mt-1">
              Saving keys is disabled. Generate a key with{" "}
              <code className="font-mono bg-red-100 px-1 rounded">
                node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
              </code>{" "}
              and add it to the server env.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {savedMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-5">
            {providers.map((field, idx) => {
              const status = statuses[field.id];
              const test = tests[field.id] ?? { status: "idle" };
              const draft = drafts[field.id] ?? "";
              const isDirty = draft.trim().length > 0;

              return (
                <div key={field.id}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">
                      {field.label}
                    </label>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {field.envVar}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {field.description}
                  </p>

                  <div className="flex items-center gap-2 mb-2 text-[11px]">
                    {status?.configured ? (
                      <>
                        <span
                          className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                            status.source === "db"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {status.source === "db" ? "Saved" : "From env"}
                        </span>
                        <span className="font-mono text-gray-500">
                          {status.preview}
                        </span>
                        {status.updatedAt && (
                          <span className="text-gray-400">
                            · {formatRelativeTime(status.updatedAt)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                        Not configured
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      id={`api-key-${field.id}`}
                      name={field.id}
                      autoComplete="off"
                      type={visible[field.id] ? "text" : "password"}
                      placeholder={
                        status?.configured
                          ? "Enter a new key to replace"
                          : field.placeholder
                      }
                      value={draft}
                      onChange={(e) => setDraft(field.id, e.target.value)}
                      className="font-mono text-xs"
                      disabled={!masterKeyConfigured}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleVisibility(field.id)}
                      className="shrink-0"
                      type="button"
                    >
                      {visible[field.id] ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    {field.testable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTest(field.id)}
                        disabled={
                          test.status === "testing" ||
                          (!isDirty && !status?.configured)
                        }
                        type="button"
                      >
                        {test.status === "testing" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    )}
                    {isDirty && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSaveOne(field.id)}
                        disabled={!masterKeyConfigured || isSaving}
                        type="button"
                      >
                        Save
                      </Button>
                    )}
                    {status?.source === "db" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(field.id)}
                        className="shrink-0"
                        type="button"
                        title="Delete saved key"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                    )}
                  </div>

                  {field.patternHint && (
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">
                      {field.patternHint}
                    </p>
                  )}

                  {test.status === "result" && (
                    <p
                      className={cn(
                        "text-[11px] mt-2",
                        test.ok ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {test.ok ? "✓ " : "✗ "}
                      {test.message}
                    </p>
                  )}

                  {idx !== providers.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={isLoading}
          type="button"
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5 mr-1", isLoading && "animate-spin")}
          />
          Refresh
        </Button>
        <Button
          onClick={handleSaveAll}
          disabled={!masterKeyConfigured || isSaving || dirtyCount === 0}
          type="button"
        >
          <Save className="w-4 h-4 mr-1" />
          {isSaving
            ? "Saving..."
            : dirtyCount > 0
              ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`
              : "Save API Keys"}
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────── Analytics Tab ────────────────────────────

function AnalyticsTab() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data: PipelineStats = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-500">{error || "No stats available"}</p>
      </div>
    );
  }

  const approvalRate =
    stats.totalIdeas > 0
      ? (
          ((stats.approvedIdeas + stats.launchedIdeas) / stats.totalIdeas) *
          100
        ).toFixed(1)
      : "0";

  const ideasPerDay =
    stats.totalIdeas > 0
      ? Math.max(stats.todayDiscoveries, 1).toFixed(1)
      : "0";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Pipeline Analytics
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Overview of your research pipeline performance
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Ideas
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.totalIdeas}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approval Rate
            </p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {approvalRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ideas/Day
            </p>
            <p className="text-2xl font-bold text-violet-600 mt-1">
              {ideasPerDay}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Today
            </p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {stats.todayDiscoveries}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline Status Breakdown</CardTitle>
          <CardDescription>
            Ideas by their current pipeline status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                label: "Pending Review",
                count: stats.pendingIdeas,
                color: "bg-gray-200",
                textColor: "text-gray-700",
              },
              {
                label: "Approved",
                count: stats.approvedIdeas,
                color: "bg-blue-200",
                textColor: "text-blue-700",
              },
              {
                label: "In Progress",
                count: stats.inProgressIdeas,
                color: "bg-violet-200",
                textColor: "text-violet-700",
              },
              {
                label: "Launched",
                count: stats.launchedIdeas,
                color: "bg-green-200",
                textColor: "text-green-700",
              },
              {
                label: "Declined",
                count: stats.declinedIdeas,
                color: "bg-red-200",
                textColor: "text-red-700",
              },
            ].map((item) => {
              const pct =
                stats.totalIdeas > 0
                  ? (item.count / stats.totalIdeas) * 100
                  : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs font-medium w-28 shrink-0",
                      item.textColor
                    )}
                  >
                    {item.label}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", item.color)}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right shrink-0">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-violet-500" />
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brain Memories
              </p>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {stats.totalMemories}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.goldenRules} golden rules active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recent Scrapes
              </p>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {stats.recentScrapes}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.topTrendingTopic
                ? `Top trend: ${stats.topTrendingTopic}`
                : "No trending topics"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ──────────────────────────── Settings Page ────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("sources");

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure sources, rules, API keys, and view pipeline analytics
        </p>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sources">
            <Globe className="w-4 h-4 mr-1.5" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Brain className="w-4 h-4 mr-1.5" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            <Key className="w-4 h-4 mr-1.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <SourcesTab />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
      </TabsRoot>
    </div>
  );
}