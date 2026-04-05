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
import { upsertSection } from "./actions"

interface Section {
  id: string
  name: string
  subject_tags: string[]
  display_order: number
}

interface Props {
  journalId: string
  section?: Section
}

export function SectionDialog({ journalId, section }: Props) {
  const isEdit = !!section
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      await upsertSection(journalId, formData)
      setOpen(false)
      formRef.current?.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={isEdit
        ? <button className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" />
        : <Button />
      }>
        {isEdit ? "Edit" : "Add section"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit section" : "Add section"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          {isEdit && <input type="hidden" name="id" value={section.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              name="name"
              placeholder="Cardiac Surgery"
              required
              defaultValue={section?.name}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject_tags">
              Subject tags
              <span className="ml-1 font-normal text-zinc-400">(comma-separated)</span>
            </Label>
            <Input
              id="subject_tags"
              name="subject_tags"
              placeholder="cardiology, cardiac, coronary"
              defaultValue={section?.subject_tags.join(", ")}
            />
            <p className="text-xs text-zinc-400">
              Manuscripts whose subject area contains any of these terms (case-insensitive) will appear in this section&apos;s queue.
              Leave blank to match manually.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display_order">Display order</Label>
            <Input
              id="display_order"
              name="display_order"
              type="number"
              min={0}
              defaultValue={section?.display_order ?? 0}
              className="w-24"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? "Save changes" : "Add section"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
