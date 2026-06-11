"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Receipt, ShoppingCart, MessageSquare,
  Lightbulb, Settings, LogOut, Users, BarChart3, Bell, UserCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

const navItems = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/expenses", label: "المصروفات", icon: Receipt },
  { href: "/dashboard/invoices", label: "الفواتير", icon: ShoppingCart },
  { href: "/dashboard/suppliers", label: "الموردون", icon: Users },
  { href: "/dashboard/reports", label: "التقارير", icon: BarChart3 },
  { href: "/dashboard/insights", label: "التحليلات", icon: Lightbulb },
  { href: "/dashboard/assistant", label: "المساعد الذكي", icon: MessageSquare },
  { href: "/dashboard/notifications", label: "الإشعارات", icon: Bell },
  { href: "/dashboard/profile", label: "الملف الشخصي", icon: UserCircle },
  { href: "/dashboard/settings", label: "الإعدادات", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden lg:flex w-64 min-h-screen bg-card border-l flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary">مدار AI</h1>
        <p className="text-xs text-muted-foreground mt-0.5">المستشار المالي الذكي</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
            {href === "/dashboard/notifications" && unread && unread > 0 && (
              <span className="mr-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
