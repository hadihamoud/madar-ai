/**
 * WhatsApp message formatter for Madar AI reports.
 * Produces ready-to-send Arabic WhatsApp messages.
 */

export interface DailySummaryData {
  restaurantName: string;
  date: Date;
  totalSales: number;
  orderCount: number;
  totalExpenses: number;
  totalPurchases: number;
  grossProfit: number;
  profitMargin: number;
  topExpenseCategory?: string;
  branchName?: string;
}

export interface WeeklySummaryData extends DailySummaryData {
  bestDay: string;
  worstDay: string;
  weekOverWeekGrowth: number;
}

function sar(n: number): string {
  return `${n.toLocaleString("ar-SA")} ر.س`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function formatDailySummary(data: DailySummaryData): string {
  const emoji = data.grossProfit >= 0 ? "✅" : "⚠️";
  const trend = data.grossProfit >= 0 ? "📈" : "📉";
  const dateStr = data.date.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return `🍽️ *${data.restaurantName}*${data.branchName ? ` — ${data.branchName}` : ""}
📅 ${dateStr}
━━━━━━━━━━━━━━━
💰 *المبيعات:* ${sar(data.totalSales)}
   └ ${data.orderCount} طلب

💸 *المصروفات:* ${sar(data.totalExpenses)}
🛒 *المشتريات:* ${sar(data.totalPurchases)}
━━━━━━━━━━━━━━━
${emoji} *صافي الربح: ${sar(data.grossProfit)}*
${trend} هامش الربح: ${pct(data.profitMargin)}${data.topExpenseCategory ? `\n📌 أكبر مصروف: ${data.topExpenseCategory}` : ""}
━━━━━━━━━━━━━━━
🤖 _مدار AI · المستشار المالي الذكي_`;
}

export function formatWeeklySummary(data: WeeklySummaryData): string {
  const emoji = data.grossProfit >= 0 ? "✅" : "⚠️";
  const growthEmoji = data.weekOverWeekGrowth >= 0 ? "📈" : "📉";

  return `🍽️ *${data.restaurantName}* — تقرير أسبوعي
━━━━━━━━━━━━━━━
💰 *إجمالي المبيعات:* ${sar(data.totalSales)}
💸 *إجمالي التكاليف:* ${sar(data.totalExpenses + data.totalPurchases)}
${emoji} *صافي الربح:* ${sar(data.grossProfit)}
   هامش الربح: ${pct(data.profitMargin)}

${growthEmoji} النمو مقارنة بالأسبوع الماضي: ${data.weekOverWeekGrowth >= 0 ? "+" : ""}${pct(data.weekOverWeekGrowth)}
📊 أفضل يوم: ${data.bestDay}
📉 أضعف يوم: ${data.worstDay}
━━━━━━━━━━━━━━━
🤖 _مدار AI · المستشار المالي الذكي_`;
}

export function formatLowProfitAlert(restaurantName: string, profit: number, margin: number): string {
  return `⚠️ *تنبيه — ${restaurantName}*
هامش الربح اليوم منخفض: *${pct(margin)}*
صافي الربح: ${sar(profit)}

💡 تحقق من المصروفات غير المعتادة أو انخفاض المبيعات.
🤖 _مدار AI_`;
}

export function formatHighExpenseAlert(restaurantName: string, category: string, amount: number): string {
  return `🚨 *تنبيه مصروفات — ${restaurantName}*
تم رصد ارتفاع في مصروفات *${category}*
المبلغ: ${sar(amount)}

💡 راجع هذه المصروفات في لوحة التحكم.
🤖 _مدار AI_`;
}
