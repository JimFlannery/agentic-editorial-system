"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { grantRole } from "./actions"

interface JournalOption {
  id: string
  name: string
  acronym: string | null
}

interface Props {
  userId: string
  userName: string
  journals: JournalOption[]
}

const ROLE_OPTIONS = [
  { value: "journal_admin", label: "Journal admin" },
  { value: "editor_in_chief", label: "Editor-in-chief" },
  { value: "editor", label: "Editor" },
  { value: "assistant_editor", label: "Assistant editor" },
  { value: "editorial_support", label: "Editorial support" },
  { value: "reviewer", label: "Reviewer" },
  { value: "author", label: "Author" },
]

export function AddRoleDialog({ userId, userName, journals }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSubmitting(true)
    try {
      const journalId = formData.get("journal_id") as string
      const role = formData.get("role") as string
      if (!journalId) throw new Error("Pick a journal")
      if (!role) throw new Error("Pick a role")
      await grantRole(userId, journalId, role)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (journals.length === 0) {
    return (
      <span className="text-xs text-muted-foreground" title="No journals exist yet">
        No journals
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors" />
        }
      >
        Add role
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add role for {userName}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="journal_id">
              Journal <span className="text-red-500">*</span>
            </Label>
            <select
              id="journal_id"
              name="journal_id"
              required
              defaultValue=""
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Select a journal…
              </option>
              {journals.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.acronym ? `${j.acronym} — ${j.name}` : j.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">
              Role <span className="text-red-500">*</span>
            </Label>
            <select
              id="role"
              name="role"
              required
              defaultValue=""
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Select a role…
              </option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
