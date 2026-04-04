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
import { addUser, editUser } from "./actions"

const ROLES = [
  { value: "author",           label: "Author" },
  { value: "reviewer",         label: "Reviewer" },
  { value: "assistant_editor", label: "Assistant Editor" },
  { value: "editor",           label: "Editor" },
  { value: "editor_in_chief",  label: "Editor-in-Chief" },
  { value: "editorial_support",label: "Editorial Support" },
  { value: "journal_admin",    label: "Journal Admin" },
]

interface Person {
  id: string
  full_name: string
  email: string
  orcid: string | null
  journal_id: string
  roles: string | null
}

interface Props {
  journalId: string
  person?: Person
}

export function AddUserDialog({ journalId, person }: Props) {
  const isEdit = !!person
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const currentRoles = new Set(
    person?.roles ? person.roles.split(", ") : []
  )

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      if (isEdit) {
        await editUser(person!.id, person!.journal_id, formData)
      } else {
        await addUser(formData)
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
        {isEdit ? "Edit" : "Add user"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          {!isEdit && (
            <input type="hidden" name="journal_id" value={journalId} />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name <span className="text-red-500">*</span></Label>
            <Input id="full_name" name="full_name" placeholder="Dr. Jane Smith" required defaultValue={person?.full_name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input id="email" name="email" type="email" placeholder="jane@example.com" required defaultValue={person?.email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orcid">ORCID</Label>
            <Input id="orcid" name="orcid" placeholder="0000-0000-0000-0000" defaultValue={person?.orcid ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name="roles"
                    value={r.value}
                    defaultChecked={currentRoles.has(r.value)}
                    className="rounded border-zinc-300"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? "Save changes" : "Add user"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
