"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface BranchSelectorProps {
  value: string | null; // null = all branches
  onChange: (branchId: string | null) => void;
  className?: string;
}

export function BranchSelector({ value, onChange, className }: BranchSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: restaurant } = trpc.restaurant.get.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const branches = restaurant?.branches ?? [];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (branches.length <= 1) return null; // Only show if multiple branches

  const selected = branches.find((b) => b.id === value);
  const label = selected ? (selected.nameAr || selected.name) : "جميع الفروع";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(!open)}
      >
        <MapPin className="w-3.5 h-3.5 text-primary" />
        {label}
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-right"
          >
            <Check className={cn("w-3.5 h-3.5 flex-shrink-0", value === null ? "opacity-100" : "opacity-0")} />
            جميع الفروع
          </button>
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => { onChange(branch.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-right"
            >
              <Check className={cn("w-3.5 h-3.5 flex-shrink-0", value === branch.id ? "opacity-100" : "opacity-0")} />
              {branch.nameAr || branch.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
