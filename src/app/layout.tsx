import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/providers/trpc-provider";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Madar AI — AI CFO for Restaurants",
  description: "Business intelligence for restaurant owners, powered by AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${geist.variable} h-full dark`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        <TRPCProvider>
          {children}
          <Toaster position="top-center" richColors />
        </TRPCProvider>
      </body>
    </html>
  );
}
