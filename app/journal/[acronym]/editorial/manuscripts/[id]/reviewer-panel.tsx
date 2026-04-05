"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import {
  searchReviewers,
  inviteReviewer,
  type ReviewerAssignment,
  type ReviewerSearchResult,
} from "./actions"

const STATUS_META: Record<string, { label: string; cls: string }> = {
  invited:   { label: "Invited",    cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  accepted:  { label: "Accepted",   cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800" },
  declined:  { label: "Declined",   cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700" },
  completed: { label: "Completed",  cls: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

function daysUntil(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return { text: "Overdue", overdue: true }
  if (diff === 0) return { text: "Due today", overdue: true }
  return { text: `${diff}d remaining`, overdue: false }
}

interface Props {
  acronym: string
  manuscriptId: string
  journalId: string
  initialReviewers: ReviewerAssignment[]
}

export default function ReviewerPanel({ acronym, manuscriptId, journalId, initialReviewers }: Props) {
  const [reviewers, setReviewers] = useState<ReviewerAssignment[]>(initialReviewers)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ReviewerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [dueDays, setDueDays] = useState("21")
  const [isPending, startTransition] = useTransition()
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([])
      }
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const r = await searchReviewers(journalId, manuscriptId, value)
      setResults(r)
      setSearching(false)
    }, 300)
  }

  function handleInvite(person: ReviewerSearchResult) {
    if (person.already_invited) return
    setInviteError(null)
    setInviteSuccess(null)
    startTransition(async () => {
      try {
        await inviteReviewer(acronym, manuscriptId, journalId, person.id, parseInt(dueDays, 10) || 21)
        setInviteSuccess(`${person.full_name} invited successfully.`)
        setQuery("")
        setResults([])
        // Optimistically add to the list
        setReviewers((prev) => [
          {
            assignment_id: crypto.randomUUID(),
            person_id: person.id,
            full_name: person.full_name,
            email: person.email,
            invitation_status: "invited",
            assigned_at: new Date().toISOString(),
            due_at: new Date(Date.now() + (parseInt(dueDays, 10) || 21) * 86_400_000).toISOString(),
          },
          ...prev.filter((r) => r.person_id !== person.id),
        ])
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : "Failed to invite reviewer.")
      }
    })
  }

  return (
    <div className="mt-8">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Reviewers</h2>
          <span className="text-xs text-muted-foreground">{reviewers.length} invited</span>
        </div>

        {/* Invite form */}
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex gap-2">
            {/* Search */}
            <div ref={searchRef} className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search by name or email…"
                className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-card text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              />
              {/* Dropdown results */}
              {(results.length > 0 || searching) && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-input bg-card shadow-lg overflow-hidden">
                  {searching && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                  )}
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={r.already_invited || isPending}
                      onClick={() => handleInvite(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {r.full_name}
                        {r.already_invited && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">already invited</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Due days */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Due in</label>
              <input
                type="number"
                min="1"
                max="90"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="w-16 text-sm border border-input rounded-lg px-2 py-2 bg-card text-foreground text-center focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </div>

          {inviteError && (
            <p className="text-xs text-red-500 dark:text-red-400">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-xs text-green-600 dark:text-green-400">{inviteSuccess}</p>
          )}
        </div>

        {/* Reviewer list */}
        {reviewers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">No reviewers invited yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Search for a person above to invite them.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {reviewers.map((r) => {
              const meta = STATUS_META[r.invitation_status]
              const due = daysUntil(r.due_at)
              return (
                <li key={r.assignment_id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.email} · Invited {formatDate(r.assigned_at)}
                      {due && (
                        <span className={`ml-2 ${due.overdue ? "text-red-500" : ""}`}>
                          · {due.text}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${meta?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
                    {meta?.label ?? r.invitation_status}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
