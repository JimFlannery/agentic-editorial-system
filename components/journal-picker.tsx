"use client"

import { useState } from "react"
import Link from "next/link"

interface Journal {
  id: string
  name: string
  acronym: string
}

interface Center {
  label: string
  description: string
  role: string
  href: (acronym: string) => string
  needsJournal: boolean
  soon?: boolean
}

const CENTERS: Center[] = [
  {
    label: "Author Center",
    description: "Submit manuscripts, track status, and respond to revision requests.",
    role: "Author",
    href: (acronym) => `/author/${acronym}`,
    needsJournal: true,
    soon: true,
  },
  {
    label: "Reviewer Center",
    description: "Access assigned manuscripts, submit reviews, and manage review invitations.",
    role: "Reviewer",
    href: (acronym) => `/reviewer/${acronym}`,
    needsJournal: true,
    soon: true,
  },
  {
    label: "Editorial Center",
    description: "Admin checklist queue, manuscript intake, reviewer assignment, and editorial decisions.",
    role: "Assistant Editor · Editor · EIC · Editorial Support",
    href: (acronym) => `/journal/${acronym}/editorial`,
    needsJournal: true,
  },
  {
    label: "Journal Admin",
    description: "Configure manuscript types, workflows, email templates, and journal settings.",
    role: "Journal administrator",
    href: (acronym) => `/journal/${acronym}/admin`,
    needsJournal: true,
  },
  {
    label: "System Admin",
    description: "Manage journals, system-level settings, and installation configuration.",
    role: "System administrator",
    href: () => "/admin",
    needsJournal: false,
  },
]

const JOURNAL_CARD_THRESHOLD = 5

export function JournalPicker({ journals }: { journals: Journal[] }) {
  const [selected, setSelected] = useState<string>(journals[0]?.acronym ?? "")

  const selectedJournal = journals.find((j) => j.acronym === selected)

  return (
    <div>
      {/* Journal selection */}
      {journals.length > 0 && (
        <div className="mb-10">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-4">
            Select Journal
          </p>
          {journals.length <= JOURNAL_CARD_THRESHOLD ? (
            <div className="flex flex-wrap gap-2">
              {journals.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelected(j.acronym)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    selected === j.acronym
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  {j.acronym}
                  <span className={`ml-2 font-normal ${selected === j.acronym ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>
                    {j.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              >
                {journals.map((j) => (
                  <option key={j.id} value={j.acronym}>
                    {j.acronym} — {j.name}
                  </option>
                ))}
              </select>
              {selectedJournal && (
                <span className="text-sm text-zinc-400">{selectedJournal.name}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Role Centers */}
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-4">
        Role Centers
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CENTERS.map((c) => {
          const href = c.needsJournal ? (selected ? c.href(selected) : "#") : c.href("")
          const disabled = c.needsJournal && !selected

          if (c.soon) {
            return (
              <div
                key={c.label}
                className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-5 py-4 opacity-60"
              >
                <div className="flex items-baseline justify-between mb-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{c.label}</p>
                  <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Soon</span>
                </div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 leading-relaxed">{c.description}</p>
                <p className="text-xs text-zinc-400">{c.role}</p>
              </div>
            )
          }

          return (
            <Link
              key={c.label}
              href={disabled ? "#" : href}
              className={`block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 transition-colors ${
                disabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:border-zinc-400 dark:hover:border-zinc-600"
              }`}
              onClick={disabled ? (e) => e.preventDefault() : undefined}
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1">{c.label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 leading-relaxed">{c.description}</p>
              <p className="text-xs text-zinc-400">{c.role}</p>
            </Link>
          )
        })}
      </div>

      {journals.length === 0 && (
        <p className="mt-4 text-xs text-zinc-400">
          No journals configured yet.{" "}
          <Link href="/admin/journals" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
            Add one in System Admin →
          </Link>
        </p>
      )}
    </div>
  )
}
