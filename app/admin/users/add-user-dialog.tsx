"use client"

import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addUser } from "./actions"

const ROLES = [
  { value: "author", label: "Author" },
  { value: "reviewer", label: "Reviewer" },
  { value: "assistant_editor", label: "Assistant Editor" },
  { value: "editor", label: "Editor" },
  { value: "editor_in_chief", label: "Editor-in-Chief" },
  { value: "editorial_support", label: "Editorial Support" },
  { value: "system_admin", label: "System Admin" },
]

interface Journal {
  id: string
  name: string
}

export function AddUserDialog({ journals }: { journals: Journal[] }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      await addUser(formData)
      setOpen(false)
      formRef.current?.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add user</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="journal_id">Journal <span className="text-red-500">*</span></Label>
            <select
              id="journal_id"
              name="journal_id"
              required
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Select a journal…</option>
              {journals.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name <span className="text-red-500">*</span></Label>
            <Input id="full_name" name="full_name" placeholder="Dr. Jane Smith" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input id="email" name="email" type="email" placeholder="jane@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orcid">ORCID</Label>
            <Input id="orcid" name="orcid" placeholder="0000-0000-0000-0000" />
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input type="checkbox" name="roles" value={r.value} className="rounded border-zinc-300" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add user</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
