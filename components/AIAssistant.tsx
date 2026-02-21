"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiX, FiSend } from "react-icons/fi";
import { useAuth } from "@/lib/AuthProvider";
import {
  createInitialQuotaSnapshot,
  getUserTier,
  type AIQuotaSnapshot,
} from "@/lib/aiPlan";
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type ChatApiResponse = {
  reply?: string;
  error?: string;
  quota?: AIQuotaSnapshot;
};

function buildQuotaText(snapshot: AIQuotaSnapshot): string {
  if (snapshot.tier === "pro") return "Unlimited AI usage";
  const chat = snapshot.remainingChat ?? 0;
  const suggestions = snapshot.remainingSuggestions ?? 0;
  const windowText = snapshot.resetWindow === "daily" ? "resets daily" : "resets monthly";
  return `${chat} chats, ${suggestions} suggestions left (${windowText})`;
}

function collectScreenContext() {
  const mainText = document.querySelector("main")?.textContent ?? "";
  const fallbackText = document.body?.textContent ?? "";
  const text = (mainText || fallbackText).replace(/\s+/g, " ").trim().slice(0, 7000);
  return {
    pathname: window.location.pathname,
    title: document.title,
    screenText: text,
  };
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session?.access_token ?? null;
}

export default function AIAssistant() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const tier = useMemo(() => getUserTier(user), [user]);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<AIQuotaSnapshot>(() => createInitialQuotaSnapshot(tier));
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I’m xTract AI. Ask about anything on this screen and I’ll use visible context to help.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuota(createInitialQuotaSnapshot(tier));
  }, [tier]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!isOpen || !user) return;

    async function fetchQuota() {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const res = await fetch("/api/ai/quota", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = (await res.json()) as { quota?: AIQuotaSnapshot };
        if (!res.ok || !data.quota) return;
        setQuota(data.quota);
      } catch (err) {
        console.error("Failed to fetch AI quota:", err);
      }
    }

    void fetchQuota();
  }, [isOpen, user, pathname]);

  const quotaText = buildQuotaText(quota);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    if (!user) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Please log in to use AI features.",
        },
      ]);
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Missing access token");
      }

      const context = collectScreenContext();
      const history = messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: question,
          history,
          context,
        }),
      });

      const data = (await res.json()) as ChatApiResponse;

      if (data.quota) {
        setQuota(data.quota);
      }

      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? "AI chat failed");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
    } catch (err) {
      console.error("AI assistant error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "AI is unavailable right now. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleOpen() {
    if (!user) {
      router.push("/login");
      return;
    }
    setIsOpen(true);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button
          onClick={handleOpen}
          aria-label="Open AI assistant"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-[#293559] to-[#041437] text-white shadow-lg transition-colors hover:bg-blue-600"
        >
          <p className="h-6 w-6"><span className="text-blue-500">x</span>AI</p>
        </button>
      ) : (
        <div className="w-[min(92vw,24rem)] rounded-xl border border-blue-500 bg-[#0e111a] text-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1f2535] px-4 py-3">
            <div>
              <p className="font-semibold text-blue-400">xTract AI</p>
              <p className="text-xs text-gray-400">{quotaText}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-gray-400 transition-colors hover:text-red-400"
              aria-label="Close AI assistant"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[22rem] space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-10 bg-blue-600 text-white"
                    : "mr-10 bg-[#141c2f] text-gray-100"
                }`}
              >
                {message.content}
              </div>
            ))}
            {sending ? <p className="text-xs text-gray-400">Thinking...</p> : null}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-[#1f2535] p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about this screen..."
              className="flex-1 rounded-md border border-[#1f2535] bg-[#141c2f] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              maxLength={300}
            />
            <button
              type="submit"
              disabled={sending || input.trim().length === 0}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              <FiSend className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
