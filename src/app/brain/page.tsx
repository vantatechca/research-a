"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ConversationItem, MessageItem } from "@/types";
import {
  Plus,
  Send,
  MessageSquare,
  Brain,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function BrainChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
      <BrainChatInner />
    </Suspense>
  );
}

function BrainChatInner() {
  // ?idea=<id> attaches a specific idea to this chat session for context.
  const searchParams = useSearchParams();
  const relatedIdeaId = searchParams.get("idea");

  // When a related idea is in the URL, fetch its title/summary so we can
  // show a banner confirming which idea is attached to this chat.
  const [relatedIdea, setRelatedIdea] = useState<{
    id: string;
    title: string;
    summary: string;
    category: string;
    priorityScore: number;
  } | null>(null);

  useEffect(() => {
    if (!relatedIdeaId) {
      setRelatedIdea(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/ideas/${relatedIdeaId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && data.id) setRelatedIdea(data);
      })
      .catch(() => {
        // Silent fail — banner just won't render
      });
    return () => {
      cancelled = true;
    };
  }, [relatedIdeaId]);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  async function fetchConversations() {
    try {
      setIsLoadingConversations(true);
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      setConversations(
        data.map((c: ConversationItem & { _count?: { messages: number } }) => ({
          ...c,
          messageCount: c._count?.messages ?? c.messageCount ?? 0,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversations"
      );
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      setIsLoadingMessages(true);
      setActiveConversationId(conversationId);
      const res = await fetch(
        `/api/conversations/${conversationId}/messages`
      );
      if (!res.ok) throw new Error("Failed to load messages");
      const data: MessageItem[] = await res.json();
      setMessages(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load messages"
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }

  function handleNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setError(null);
    inputRef.current?.focus();
  }

  async function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setInputValue("");

    // Optimistically add user message
    const userMessage: MessageItem = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Add placeholder assistant message for streaming
    const assistantId = `stream-${Date.now()}`;
    const assistantMessage: MessageItem = {
      id: assistantId,
      role: "assistant",
      content: "",
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setIsStreaming(true);

    try {
      const res = await fetch("/api/brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId: activeConversationId,
          relatedIdeaId: relatedIdeaId || undefined,
        }),
        });

      if (!res.ok) throw new Error("Failed to send message");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let newConversationId = activeConversationId;
      // SSE events are delimited by "\n\n". A single chunk may end mid-event,
      // so we keep a buffer and only consume complete events; leftover bytes
      // carry over to the next read. Without this, partial JSON gets silently
      // dropped on chunk boundaries.
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);

          for (const line of rawEvent.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.done && parsed.conversationId) {
                newConversationId = parsed.conversationId;
                continue;
              }

              if (parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: accumulated }
                      : m
                  )
                );
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }

      // Update conversation ID if new conversation was created
      if (newConversationId && newConversationId !== activeConversationId) {
        setActiveConversationId(newConversationId);
        fetchConversations();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get response"
      );
      // Remove the empty assistant message on error
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-screen">
      {/* Conversations Sidebar */}
      <aside className="w-[250px] border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-100">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleNewChat}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Start a new chat to begin
              </p>
            </div>
          ) : (
            <div className="py-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => loadMessages(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-l-2",
                    activeConversationId === conv.id
                      ? "border-l-violet-600 bg-violet-50/50"
                      : "border-l-transparent"
                  )}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {conv.title || "Untitled Chat"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatRelativeTime(conv.updatedAt)}
                    {conv.messageCount
                      ? ` \u00b7 ${conv.messageCount} messages`
                      : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        {relatedIdea && (
          <div className="mx-4 mt-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-900 dark:bg-purple-950/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-3 w-3" />
                  Discussing idea
                </div>
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {relatedIdea.title}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                  {relatedIdea.summary}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    {relatedIdea.category}
                  </span>
                  <span>Priority: {relatedIdea.priorityScore?.toFixed?.(1) ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-violet-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                PeptideBrain Assistant
              </h3>
              <p className="text-sm text-gray-500 max-w-md">
                Ask me about peptide research, product ideas, market trends, or
                anything related to your pipeline. I have context on all your
                data and golden rules.
              </p>
              <Separator className="my-6 max-w-xs" />
              <div className="grid grid-cols-2 gap-2 text-xs max-w-sm">
                {[
                  "What are the top trending peptide topics?",
                  "Analyze BPC-157 product opportunities",
                  "What ideas should I prioritize?",
                  "Summarize today's discoveries",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInputValue(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-left text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {truncate(suggestion, 40)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-800 rounded-bl-md"
                    )}
                  >
                    {msg.role === "assistant" && !msg.content && isStreaming ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mb-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 ml-2 text-xs font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-gray-200 bg-white px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Input
              ref={inputRef}
              id="brain-chat-message"
              name="message"
              autoComplete="off"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask PeptideBrain anything..."
              disabled={isStreaming}
              className="flex-1 h-11 rounded-xl bg-gray-50 border-gray-200 focus-visible:bg-white"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming}
              className="h-11 w-11 rounded-xl bg-violet-600 hover:bg-violet-700 shrink-0"
              size="icon-lg"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
