"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import { AiChatMessage } from "./ai-chat-message";
import { cn } from "@/shared/lib/utils";

interface Message {
  role: "user" | "model";
  content: string;
}

export function AiChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: conversationId,
        }),
      });
      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [...prev, { role: "model", content: data.reply }]);
      }
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "model", content: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors",
          isOpen ? "bg-bg-tertiary" : "bg-accent"
        )}
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} className="text-white" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-20 right-6 z-50 w-96 h-[500px] rounded-lg border border-border bg-bg-secondary shadow-lg flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">AI Advisor</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              {messages.length === 0 && (
                <div className="text-center text-text-tertiary text-sm py-8">
                  Ask anything about your budget, spending, or finances.
                </div>
              )}
              {messages.map((msg, i) => (
                <AiChatMessage key={i} role={msg.role} content={msg.content} />
              ))}
              {loading && (
                <div className="flex gap-3 py-3">
                  <div className="w-7 h-7 rounded-full bg-bg-tertiary flex items-center justify-center">
                    <span className="animate-pulse text-accent text-xs">···</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about your finances..."
                  className="flex-1 px-3 py-2 rounded-md bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="p-2 rounded-md bg-accent text-white disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
