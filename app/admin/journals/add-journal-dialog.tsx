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
import { addJournal } from "./actions"

export function AddJournalDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      await addJournal(formData)
      setOpen(false)
      formRef.current?.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add journal</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add journal</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" placeholder="Journal of Example Studies" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issn">ISSN</Label>
            <Input id="issn" name="issn" placeholder="0000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject_area">Subject area</Label>
            <Input id="subject_area" name="subject_area" placeholder="e.g. Life Sciences" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add journal</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
