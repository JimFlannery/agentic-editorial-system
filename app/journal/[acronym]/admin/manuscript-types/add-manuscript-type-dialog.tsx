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
import { addManuscriptType, editManuscriptType } from "./actions"

interface ManuscriptType {
  id: string
  name: string
  acronym: string
  description: string | null
  display_order: number
  active: boolean
}

interface Props {
  journalId: string
  type?: ManuscriptType
}

export function AddManuscriptTypeDialog({ journalId, type }: Props) {
  const isEdit = !!type
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      if (isEdit) {
        await editManuscriptType(type!.id, formData)
      } else {
        await addManuscriptType(formData)
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
        ? <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" />
        : <Button />
      }>
        {isEdit ? "Edit" : "Add type"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit manuscript type" : "Add manuscript type"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          {!isEdit && (
            <input type="hidden" name="journal_id" value={journalId} />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" placeholder="Original Research" required defaultValue={type?.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acronym">Acronym <span className="text-red-500">*</span></Label>
            <Input id="acronym" name="acronym" placeholder="OR" className="uppercase" required defaultValue={type?.acronym} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Optional description" defaultValue={type?.description ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display_order">Display order</Label>
            <Input id="display_order" name="display_order" type="number" min="0" defaultValue={type?.display_order ?? 0} />
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="active">Status</Label>
              <select
                id="active"
                name="active"
                defaultValue={type?.active ? "true" : "false"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? "Save changes" : "Add type"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
