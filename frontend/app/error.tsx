"use client";

import React, { useEffect } from "react";
import { AlertOctagon, RefreshCw, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Client Error caught by boundary:", error);

    // Auto-reload on ChunkLoadError or new deployment chunk mismatches
    const errMsg = (error?.message || "") + " " + (error?.name || "");
    if (
      errMsg.includes("ChunkLoadError") ||
      errMsg.includes("Loading chunk") ||
      errMsg.includes("failed to fetch dynamically imported module")
    ) {
      const lastReload = Number(sessionStorage.getItem("chunk_reload_ts") || "0");
      // Throttle reload loop protection (at least 10 seconds between auto-reloads)
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem("chunk_reload_ts", Date.now().toString());
        window.location.reload();
      }
    }
  }, [error]);

  const isChunkError =
    error?.message?.includes("ChunkLoadError") ||
    error?.message?.includes("Loading chunk");

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-lg bg-app-card border border-app-border rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-silicon-ruby/15 border border-silicon-ruby/30 flex items-center justify-center text-silicon-ruby shadow-glow-ruby">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-base font-bold text-app-text tracking-tight font-sans">
              {isChunkError ? "Application Update Detected" : "Execution Exception Occurred"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-silicon-ruby/20 text-silicon-ruby border border-silicon-ruby/30 uppercase">
              {isChunkError ? "CHUNK SYNC" : "CLIENT RECOVERY"}
            </span>
          </div>

          <p className="text-xs text-app-muted leading-relaxed max-w-sm mx-auto">
            {isChunkError
              ? "A newer version of the platform was deployed. Your browser was holding onto an earlier asset manifest."
              : error?.message || "An unexpected client exception interrupted the current telemetry view."}
          </p>
        </div>

        {error?.digest && (
          <div className="text-[10px] text-app-subtle bg-app-surface px-3 py-1.5 rounded-lg border border-app-border inline-block">
            Digest Ref: {error.digest}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.location.reload()}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Reload & Sync Latest
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => reset()}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Retry Component
          </Button>

          <Link href="/">
            <Button variant="ghost" size="sm" icon={<Home className="w-4 h-4" />}>
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
