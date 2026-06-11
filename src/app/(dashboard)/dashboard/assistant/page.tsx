"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Bot, User, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

const QUICK_QUESTIONS = [
  "كم بعت اليوم؟",
  "ما هي أكبر مصروفاتي؟",
  "أي فرع يؤدي أفضل؟",
  "ما هو هامش الربح هذا الشهر؟",
];

export default function AssistantPage() {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Array<{ role: string; content: string; id?: string }>>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message.content, id: data.message.id },
      ]);
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(text: string) {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    chat.mutate({ conversationId, message: text });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function newConversation() {
    setConversationId(undefined);
    setMessages([]);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-screen max-h-screen p-6 pb-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">المساعد الذكي</h1>
          <p className="text-muted-foreground text-sm">اسأل عن أي شيء يتعلق بأعمالك</p>
        </div>
        <Button variant="outline" size="sm" onClick={newConversation}>
          <Plus className="w-4 h-4 ml-2" />
          محادثة جديدة
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto text-primary mb-4" />
            <h2 className="text-lg font-semibold mb-2">كيف يمكنني مساعدتك؟</h2>
            <p className="text-muted-foreground text-sm mb-6">اسأل أي سؤال عن مبيعاتك أو مصروفاتك أو أداء فروعك</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_QUESTIONS.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(q)}
                  disabled={chat.isPending}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <Card className={cn("max-w-[75%]", msg.role === "user" ? "bg-primary text-primary-foreground border-primary" : "")}>
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <Card>
              <CardContent className="p-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t py-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب سؤالك هنا..."
            disabled={chat.isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={chat.isPending || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
