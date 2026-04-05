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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
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
                      ? "border-foreground bg-foreground text-background"
                      : "border-input text-muted-foreground hover:border-border"
                  }`}
                >
                  {j.acronym}
                  <span className={`ml-2 font-normal ${selected === j.acronym ? "text-border" : "text-muted-foreground"}`}>
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
                className="text-sm text-foreground bg-card border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-border"
              >
                {journals.map((j) => (
                  <option key={j.id} value={j.acronym}>
                    {j.acronym} — {j.name}
                  </option>
                ))}
              </select>
              {selectedJournal && (
                <span className="text-sm text-muted-foreground">{selectedJournal.name}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Role Centers */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
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
                className="rounded-xl border border-dashed border-border px-5 py-4 opacity-60"
              >
                <div className="flex items-baseline justify-between mb-1">
                  <p className="font-medium text-foreground text-sm">{c.label}</p>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{c.description}</p>
                <p className="text-xs text-muted-foreground">{c.role}</p>
              </div>
            )
          }

          return (
            <Link
              key={c.label}
              href={disabled ? "#" : href}
              className={`block rounded-xl border border-border bg-card px-5 py-4 transition-colors ${
                disabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:border-border"
              }`}
              onClick={disabled ? (e) => e.preventDefault() : undefined}
            >
              <p className="font-medium text-foreground text-sm mb-1">{c.label}</p>
              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{c.description}</p>
              <p className="text-xs text-muted-foreground">{c.role}</p>
            </Link>
          )
        })}
      </div>

      {journals.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          No journals configured yet.{" "}
          <Link href="/admin/journals" className="underline hover:text-foreground">
            Add one in System Admin →
          </Link>
        </p>
      )}
    </div>
  )
}
