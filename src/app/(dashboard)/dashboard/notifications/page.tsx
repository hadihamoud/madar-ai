"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  info: { icon: Info, color: "text-blue-500", bg: "" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "border-yellow-500/20" },
  success: { icon: CheckCircle, color: "text-green-500", bg: "border-green-500/20" },
  error: { icon: XCircle, color: "text-red-500", bg: "border-red-500/30" },
} as const;

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.notifications.list.useQuery({ limit: 50 });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("تم تعليم الكل كمقروء");
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const unread = data?.filter(n => !n.isRead).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الإشعارات</h1>
          {unread > 0 && <p className="text-sm text-muted-foreground">{unread} غير مقروء</p>}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck className="w-4 h-4 ml-2" />
            تعليم الكل كمقروء
          </Button>
        )}
      </div>

      {isLoading && [1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}

      <div className="space-y-2">
        {data?.map(n => {
          const cfg = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <Card
              key={n.id}
              className={cn(
                "cursor-pointer transition-all",
                cfg.bg,
                !n.isRead && "ring-1 ring-primary/20 bg-primary/[0.02]"
              )}
              onClick={() => { if (!n.isRead) markRead.mutate({ id: n.id }); }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{n.title}</p>
                      {!n.isRead && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ar })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && !data?.length && (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-30" />
            <p className="text-muted-foreground">لا توجد إشعارات بعد</p>
          </div>
        )}
      </div>
    </div>
  );
}
