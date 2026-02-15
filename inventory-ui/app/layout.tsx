"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import BottomNav from "@/components/BottomNav";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  // Hide bottom nav on login and detail pages
  const showBottomNav = pathname !== "/login" && 
                        !pathname.includes("/detail") &&
                        !pathname.match(/\/(receipts|deliveries|transfers)\/\d+/);

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className={showBottomNav ? "pb-16" : ""}>
          {children}
        </div>
        {showBottomNav && <BottomNav />}
        <Toaster />
      </body>
    </html>
  );
}
