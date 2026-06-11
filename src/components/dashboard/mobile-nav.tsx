"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Receipt, ShoppingCart, MessageSquare,
  Lightbulb, Settings, LogOut, Menu, X, Users, BarChart3, Bell, UserCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b flex items-center justify-between px-4">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <span className="font-bold text-primary">مدار AI</span>
        <div className="w-9" />
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "lg:hidden fixed top-0 right-0 z-50 h-full w-72 bg-card border-l transform transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-primary">مدار AI</h1>
            <p className="text-xs text-muted-foreground">المستشار المالي الذكي</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
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
      </div>
    </>
  );
}
