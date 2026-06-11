"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, FileText, DollarSign, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const ACTION_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  CREATE: { label: "إنشاء", variant: "default" },
  UPDATE: { label: "تعديل", variant: "secondary" },
  DELETE: { label: "حذف", variant: "destructive" },
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  Expense: DollarSign,
  PurchaseInvoice: ShoppingCart,
  Restaurant: FileText,
};

export default function AuditPage() {
  const { data, isLoading } = trpc.audit.list.useQuery({ limit: 100 });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          سجل التدقيق
        </h1>
        <p className="text-muted-foreground text-sm mt-1">جميع العمليات المالية مسجلة وغير قابلة للحذف</p>
      </div>

      {isLoading && [1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}

      <div className="space-y-2">
        {data?.items.map(log => {
          const Icon = ENTITY_ICONS[log.entity] ?? FileText;
          const actionCfg = ACTION_CONFIG[log.action] ?? { label: log.action, variant: "outline" as const };
          return (
            <Card key={log.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={actionCfg.variant} className="text-xs">{actionCfg.label}</Badge>
                    <span className="text-sm font-medium">{log.entity}</span>
                    {log.entityId && <span className="text-xs text-muted-foreground font-mono">{log.entityId.slice(-8)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.user ? `${log.user.name ?? log.user.email}` : "النظام"} ·{" "}
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ar })}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && !data?.items.length && (
          <p className="text-center text-muted-foreground py-10">لا توجد سجلات بعد</p>
        )}
      </div>
    </div>
  );
}
