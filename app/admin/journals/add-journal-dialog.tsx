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
import { addJournal, editJournal } from "./actions"

interface Journal {
  id: string
  name: string
  acronym: string | null
  issn: string | null
  subject_area: string | null
}

interface Props {
  journal?: Journal
}

export function AddJournalDialog({ journal }: Props = {}) {
  const isEdit = !!journal
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      if (isEdit) {
        await editJournal(journal!.id, formData)
      } else {
        await addJournal(formData)
        formRef.current?.reset()
      }
      setOpen(false)
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
        {isEdit ? "Edit" : "Add journal"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit journal" : "Add journal"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" placeholder="Journal of Example Studies" required defaultValue={journal?.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acronym">Acronym <span className="text-red-500">*</span></Label>
            <Input id="acronym" name="acronym" placeholder="e.g. JES" required defaultValue={journal?.acronym ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issn">ISSN</Label>
            <Input id="issn" name="issn" placeholder="0000-0000" defaultValue={journal?.issn ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject_area">Subject area</Label>
            <Input id="subject_area" name="subject_area" placeholder="e.g. Life Sciences" defaultValue={journal?.subject_area ?? ""} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? "Save changes" : "Add journal"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
