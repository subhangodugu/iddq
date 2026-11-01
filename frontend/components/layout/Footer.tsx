"use client";

import React from "react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-app-border bg-app-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 text-xs text-app-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          IDDQ Optimizer <span className="text-app-subtle">·</span> Release v1.0.0
        </p>
        <a
          href="http://127.0.0.1:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="hover:text-silicon-cyan"
        >
          API reference
        </a>
      </div>
    </footer>
  );
}
