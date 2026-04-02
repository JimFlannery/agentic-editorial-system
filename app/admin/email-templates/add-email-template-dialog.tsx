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
import { addEmailTemplate, editEmailTemplate } from "./actions"

interface Template {
  id: string
  name: string
  subject: string
  description: string
  body: string
}

interface Props {
  template?: Template
}

export function AddEmailTemplateDialog({ template }: Props = {}) {
  const isEdit = !!template
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      if (isEdit) {
        await editEmailTemplate(template!.id, formData)
      } else {
        await addEmailTemplate(formData)
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
        {isEdit ? "Edit" : "Add template"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit email template" : "Add email template"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" placeholder="LateReviewerReminder" required defaultValue={template?.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject <span className="text-red-500">*</span></Label>
            <Input id="subject" name="subject" placeholder="Reminder: your review is due" required defaultValue={template?.subject} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="When is this template used?" defaultValue={template?.description} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Body <span className="text-red-500">*</span></Label>
            <textarea
              id="body"
              name="body"
              required
              rows={6}
              placeholder={"Dear {{reviewer_name}},\n\nThis is a reminder that your review of…"}
              defaultValue={template?.body}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-y"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? "Save changes" : "Add template"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
