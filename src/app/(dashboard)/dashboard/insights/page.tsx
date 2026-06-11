"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const SEVERITY_CONFIG = {
  info: { color: "text-blue-500", bg: "border-blue-500/20", icon: Info, label: "معلومة" },
  warning: { color: "text-yellow-500", bg: "border-yellow-500/30", icon: AlertTriangle, label: "تحذير" },
  critical: { color: "text-red-500", bg: "border-red-500/30", icon: AlertTriangle, label: "عاجل" },
} as const;

const TYPE_LABELS: Record<string, string> = {
  PROFIT_SUMMARY: "ملخص الأرباح",
  COST_WARNING: "تحذير تكاليف",
  SALES_TREND: "اتجاه المبيعات",
  SUPPLIER_ALERT: "تنبيه موردين",
  FORECAST: "توقعات",
  GENERAL: "عام",
};

export default function InsightsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ai.listInsights.useQuery({ limit: 50 });
  const generateInsights = trpc.ai.generateInsights.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء ${data.length} تحليلات جديدة`);
      utils.ai.listInsights.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const markRead = trpc.ai.markInsightRead.useMutation({
    onSuccess: () => utils.ai.listInsights.invalidate(),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التحليلات الذكية</h1>
          <p className="text-muted-foreground text-sm">رؤى وتوصيات مدعومة بالذكاء الاصطناعي</p>
        </div>
        <Button
          onClick={() => generateInsights.mutate()}
          disabled={generateInsights.isPending}
        >
          <Lightbulb className="w-4 h-4 ml-2" />
          {generateInsights.isPending ? "جاري التحليل..." : "توليد تحليلات جديدة"}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {data?.map((insight) => {
          const sev = SEVERITY_CONFIG[insight.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
          const SevIcon = sev.icon;
          return (
            <Card
              key={insight.id}
              className={`${sev.bg} ${!insight.isRead ? "ring-1 ring-primary/20" : "opacity-75"} cursor-pointer`}
              onClick={() => !insight.isRead && markRead.mutate({ id: insight.id })}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <SevIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${sev.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{insight.title}</p>
                      {!insight.isRead && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[insight.type] ?? insight.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(insight.createdAt), "d MMM، HH:mm", { locale: ar })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && data?.length === 0 && (
          <div className="text-center py-12">
            <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد تحليلات بعد.</p>
            <p className="text-sm text-muted-foreground">انقر على "توليد تحليلات جديدة" للبدء.</p>
          </div>
        )}
      </div>
    </div>
  );
}
