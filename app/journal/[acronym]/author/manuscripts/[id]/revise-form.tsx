"use client"

import { useRef, useState, useTransition } from "react"
import { submitRevision } from "./actions"

interface Props {
  acronym: string
  manuscriptId: string
  journalId: string
}

export default function ReviseForm({ acronym, manuscriptId, journalId }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const letter = (formData.get("response_letter") as string)?.trim()
    const file = formData.get("manuscript_file") as File | null

    if (!letter) { setError("A response letter is required."); return }
    if (!file || file.size === 0) { setError("Please attach the revised manuscript file."); return }

    startTransition(async () => {
      try {
        await submitRevision(acronym, manuscriptId, journalId, formData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
      }
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Submit Revision</h2>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          Upload your revised manuscript and include a response letter addressing the reviewers&apos; comments.
        </p>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Response letter */}
        <div>
          <label
            htmlFor="response_letter"
            className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            Response Letter <span className="text-red-500">*</span>
          </label>
          <textarea
            id="response_letter"
            name="response_letter"
            rows={8}
            placeholder="Describe the changes you made and how you addressed each reviewer comment…"
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
          />
        </div>

        {/* File upload */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Revised Manuscript <span className="text-red-500">*</span>
          </p>
          <label className="flex items-center gap-3 cursor-pointer group">
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-700 transition-colors">
              Choose file
            </span>
            <span className="text-xs text-zinc-400 truncate">
              {fileName ?? "No file chosen"}
            </span>
            <input
              type="file"
              name="manuscript_file"
              accept=".pdf,.doc,.docx,.tex,.zip"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
          <p className="text-xs text-zinc-400 mt-1">PDF, Word, LaTeX, or ZIP</p>
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Submitting…" : "Submit Revision"}
          </button>
        </div>
      </div>
    </form>
  )
}
