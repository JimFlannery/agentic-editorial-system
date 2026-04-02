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
import { addManuscriptType } from "./actions"

interface Journal {
  id: string
  name: string
}

export function AddManuscriptTypeDialog({ journals }: { journals: Journal[] }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      await addManuscriptType(formData)
      setOpen(false)
      formRef.current?.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add type</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add manuscript type</DialogTitle>
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
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" placeholder="Original Research" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acronym">Acronym <span className="text-red-500">*</span></Label>
            <Input id="acronym" name="acronym" placeholder="OR" className="uppercase" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Optional description" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display_order">Display order</Label>
            <Input id="display_order" name="display_order" type="number" defaultValue="0" min="0" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add type</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
