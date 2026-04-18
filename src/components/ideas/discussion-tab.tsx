"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  MessageSquare,
} from "lucide-react";

interface DiscussionTabProps {
  ideaId: string;
  ideaTitle: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function DiscussionTab({ ideaId, ideaTitle }: DiscussionTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          relatedIdeaId: ideaId,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.done && data.conversationId) {
              setConversationId(data.conversationId);
            } else if (data.text) {
              accumulatedText += data.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsg.id
                    ? { ...msg, content: accumulatedText }
                    : msg
                )
              );
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }

      // Mark streaming complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsg.id
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch {
      // Remove the empty assistant message on error
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== assistantMsg.id)
      );

      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I encountered an error processing your message. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="mt-4">
      <Card className="flex flex-col h-[520px]">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <EmptyState ideaTitle={ideaTitle} onSuggest={setInput} />
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              placeholder={`Ask about "${ideaTitle}"...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="resize-none text-sm min-h-[60px]"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 h-10"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}

/* =============================
   Sub-components
   ============================= */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-gray-100 text-gray-600"
            : "bg-violet-100 text-violet-600"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
          isUser
            ? "bg-gray-900 text-white"
            : "bg-gray-50 text-gray-800 border border-gray-100"
        }`}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && !message.content && (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Thinking...
            </span>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  ideaTitle,
  onSuggest,
}: {
  ideaTitle: string;
  onSuggest: (text: string) => void;
}) {
  const suggestions = [
    `What is the market opportunity for "${ideaTitle}"?`,
    "Who would be the ideal customer for this product?",
    "What would a minimum viable product look like?",
    "How should I price and position this product?",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-violet-500" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        Deep Dive into this idea
      </h3>
      <p className="text-xs text-gray-500 mb-5 max-w-sm">
        Ask the AI Brain anything about this idea. It has full context about the research data, market signals, and competitive landscape.
      </p>
      <div className="space-y-2 w-full max-w-md">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSuggest(s)}
            className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 text-xs text-gray-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-colors flex items-center gap-2"
          >
            <MessageSquare className="w-3 h-3 shrink-0 text-gray-400" />
            <span className="truncate">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
