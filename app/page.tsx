"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
      )}
    </button>
  );
}

const features = [
  {
    title: "Graph-native workflows",
    description:
      "Every workflow — gates, decisions, escalations — is stored as a property graph. Infinitely configurable without code changes.",
  },
  {
    title: "AI-assisted configuration",
    description:
      "Describe your review process in plain language. Claude translates it into the graph and waits for your confirmation before applying changes.",
  },
  {
    title: "Multi-journal tenancy",
    description:
      "Host multiple journals on one instance. Each journal has its own editorial team, reviewer pool, and workflow — fully isolated by row-level security.",
  },
  {
    title: "Agentic reviewer selection",
    description:
      "Claude agents traverse the graph to find reviewers by subject area, recency, and conflict-of-interest distance from the authors.",
  },
  {
    title: "Open source, AGPLv3",
    description:
      "Self-host on any VPS, Railway, or Azure. No vendor lock-in. Swap object storage, email provider, and auth via environment variables.",
  },
  {
    title: "Full audit trail",
    description:
      "Every gate evaluation, state transition, and agent action is recorded in an append-only event log — queryable and exportable.",
  },
];

const links = [
  {
    href: "/admin",
    label: "Admin console",
    description: "Manage journals, users, workflows, and email templates.",
    primary: true,
  },
  {
    href: "/admin/workflow",
    label: "Configure workflows",
    description: "Use the AI assistant to define or modify review workflows.",
    primary: false,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Nav */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-4">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-sm">
            Agentic Editorial System
          </span>
          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/admin"
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Admin
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6">
        {/* Hero */}
        <section className="py-20 max-w-2xl">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-4">
            Open source · AGPLv3
          </p>
          <h1 className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100 leading-tight mb-5">
            Editorial workflow management,<br />powered by a property graph.
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8 max-w-xl">
            An open-source editorial management system for academic journals. Workflows are stored
            as a configurable graph — not hardcoded — and Claude agents automate reviewer selection,
            conflict detection, and deadline tracking.
          </p>
          <div className="flex flex-wrap gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  l.primary
                    ? "rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-5 py-2.5 hover:opacity-90 transition-opacity"
                    : "rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                }
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-900" />

        {/* Features */}
        <section className="py-16">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-10">
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title}>
                <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1.5">
                  {f.title}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-900" />

        {/* Footer */}
        <footer className="py-8 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-600">
          <span>Agentic Editorial System — AGPLv3</span>
          <a
            href="https://github.com/anthropics/claude-code"
            className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            Built with Claude Code
          </a>
        </footer>
      </div>
    </div>
  );
}
