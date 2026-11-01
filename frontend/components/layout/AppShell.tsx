"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { Footer } from "@/components/layout/Footer";
import AmbientCanvas from "@/components/ui/AmbientCanvas";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global resilience against deployment overwrite / ChunkLoadError
  useEffect(() => {
    function handleChunkError(event: ErrorEvent) {
      const msg = (event.message || "").toLowerCase();
      if (
        msg.includes("chunkloaderror") ||
        msg.includes("loading chunk") ||
        msg.includes("failed to fetch dynamically imported module")
      ) {
        const lastReload = Number(sessionStorage.getItem("chunk_reload_ts") || "0");
        if (Date.now() - lastReload > 10000) {
          sessionStorage.setItem("chunk_reload_ts", Date.now().toString());
          window.location.reload();
        }
      }
    }

    window.addEventListener("error", handleChunkError);
    return () => window.removeEventListener("error", handleChunkError);
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
      <div className="min-h-screen flex flex-col bg-app-bg text-app-text font-sans relative selection:bg-silicon-cyan/30 selection:text-app-text">
        {/* Subtle Ambient Particle Background */}
        <AmbientCanvas />

        {/* Global Navbar */}
        <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

        {/* Body Layout: Sidebar + Main Stage */}
        <div className="flex flex-1 relative z-10">
          <Sidebar
            isMobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />

          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>

            {/* Global Footer */}
            <Footer />
          </div>
        </div>
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
