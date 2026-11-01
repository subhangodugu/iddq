"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_NAME_MAP: Record<string, string> = {
  "": "Home",
  realtime: "Real-Time ATE Prober",
  datasets: "Dataset Management",
  defects: "Detected Defects",
  "baseline-screens": "Baseline Screens",
  "die-analysis": "Die Diagnosis",
  "wafer-analysis": "Wafer & Lot Drift",
  "settling-prediction": "Settling Prediction",
  "vector-optimization": "Vector Optimization",
  "adaptive-testing": "Adaptive Testing",
  "validation-gates": "Release Gates",
  reports: "Reports & Lineage",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-[11px] text-app-subtle">
      <Link
        href="/"
        className="flex items-center space-x-1 hover:text-silicon-cyan transition-colors"
        title="Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">IDDQ Platform</span>
      </Link>

      {segments.map((seg, idx) => {
        const href = "/" + segments.slice(0, idx + 1).join("/");
        const isLast = idx === segments.length - 1;
        const name = ROUTE_NAME_MAP[seg] || decodeURIComponent(seg);

        return (
          <React.Fragment key={href}>
            <ChevronRight className="w-3 h-3 text-app-subtle opacity-60" />
            {isLast ? (
              <span className="text-app-text font-semibold capitalize truncate max-w-[200px]">
                {name}
              </span>
            ) : (
              <Link href={href} className="hover:text-silicon-cyan transition-colors capitalize">
                {name}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
