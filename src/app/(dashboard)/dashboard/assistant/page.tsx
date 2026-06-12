"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Bot, User, Plus, MessageSquare, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

const QUICK_QUESTIONS = [
  "كم بعت اليوم؟",
  "ما هي أكبر مصروفاتي؟",
  "أي فرع يؤدي أفضل؟",
  "ما هو هامش الربح هذا الشهر؟",
  "قارن أداء هذا الأسبوع بالأسبوع الماضي",
  "أين يمكنني تخفيض التكاليف؟",
];

type Msg = { role: string; content: string; id?: string };

export default function AssistantPage() {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: conversations, refetch: refetchConversations } =
    trpc.ai.listConversations.useQuery(undefined, { refetchOnWindowFocus: false });

  const { data: conversationData } = trpc.ai.getConversation.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId, refetchOnWindowFocus: false }
  );

  // Load messages when switching conversations
  useEffect(() => {
    if (conversationData) {
      setMessages(
        conversationData.messages.map((m) => ({
          role: m.role,
          content: m.content,
          id: m.id,
        }))
      );
    }
  }, [conversationData?.id]);

  const chat = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      if (!conversationId) {
        setConversationId(data.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message.content, id: data.message.id },
      ]);
      refetchConversations();
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
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function loadConversation(id: string) {
    if (id === conversationId) return;
    setConversationId(id);
    setMessages([]);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden">
      {/* Sidebar — conversation history */}
      <aside className={cn(
        "flex-shrink-0 border-l bg-background transition-all duration-200 flex flex-col",
        sidebarOpen ? "w-64" : "w-0 overflow-hidden"
      )}>
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm font-semibold">المحادثات</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={newConversation}>
            <Plus className="w-3 h-3 ml-1" />
            جديدة
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations?.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">لا توجد محادثات سابقة</p>
          )}
          {conversations?.map((conv) => {
            const lastMsg = conv.messages[0];
            return (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  "w-full text-right rounded-lg p-2.5 text-sm transition-colors hover:bg-muted",
                  conv.id === conversationId ? "bg-primary/10 text-primary" : ""
                )}
              >
                <p className="font-medium truncate text-xs leading-snug">{conv.title || "محادثة"}</p>
                {lastMsg && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
                    {lastMsg.content.slice(0, 50)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDistanceToNow(new Date(conv.updatedAt), { locale: ar, addSuffix: true })}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="تبديل القائمة الجانبية"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-none">المساعد الذكي</h1>
              <p className="text-muted-foreground text-xs mt-0.5">اسأل عن أي شيء يتعلق بأعمالك</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={newConversation} className="h-8">
            <Plus className="w-3.5 h-3.5 ml-1.5" />
            <span className="hidden sm:inline">محادثة جديدة</span>
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <Bot className="w-12 h-12 mx-auto text-primary mb-4" />
              <h2 className="text-lg font-semibold mb-2">كيف يمكنني مساعدتك؟</h2>
              <p className="text-muted-foreground text-sm mb-6">
                اسأل أي سؤال عن مبيعاتك أو مصروفاتك أو أداء فروعك
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {QUICK_QUESTIONS.map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(q)}
                    disabled={chat.isPending}
                    className="text-xs"
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <Card className={cn(
                "max-w-[80%]",
                msg.role === "user" ? "bg-primary text-primary-foreground border-primary" : ""
              )}>
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
        <div className="border-t p-4 flex-shrink-0">
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
    </div>
  );
}
