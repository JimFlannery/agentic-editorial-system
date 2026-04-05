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
  { value: "author",            label: "Author" },
  { value: "reviewer",          label: "Reviewer" },
  { value: "assistant_editor",  label: "Assistant Editor" },
  { value: "editor",            label: "Editor" },
  { value: "editor_in_chief",   label: "Editor-in-Chief" },
  { value: "editorial_support", label: "Editorial Support" },
  { value: "journal_admin",     label: "Journal Admin" },
]

// Roles that can be scoped to a section
const SECTIONABLE_ROLES = new Set([
  "assistant_editor",
  "editor",
  "editorial_support",
  "editor_in_chief",
])

interface Section {
  id: string
  name: string
}

interface Person {
  id: string
  full_name: string
  email: string
  orcid: string | null
  journal_id: string
  roles: string | null
  role_sections: Record<string, string | null> | null
}

interface Props {
  journalId: string
  person?: Person
  sections?: Section[]
}

export function AddUserDialog({ journalId, person, sections = [] }: Props) {
  const isEdit = !!person
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedRoles, setCheckedRoles] = useState<Set<string>>(
    new Set(person?.roles ? person.roles.split(", ") : [])
  )
  const formRef = useRef<HTMLFormElement>(null)

  function toggleRole(role: string, checked: boolean) {
    setCheckedRoles((prev) => {
      const next = new Set(prev)
      if (checked) next.add(role)
      else next.delete(role)
      return next
    })
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      if (isEdit) {
        await editUser(person!.id, person!.journal_id, formData)
      } else {
        await addUser(formData)
        formRef.current?.reset()
        setCheckedRoles(new Set())
      }
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  const sectionableChecked = ROLES.filter(
    (r) => SECTIONABLE_ROLES.has(r.value) && checkedRoles.has(r.value)
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={isEdit
        ? <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" />
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
                <label key={r.value} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    name="roles"
                    value={r.value}
                    checked={checkedRoles.has(r.value)}
                    onChange={(e) => toggleRole(r.value, e.target.checked)}
                    className="rounded border-input"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Section assignments — only shown when sectionable roles are checked and sections exist */}
          {sections.length > 0 && sectionableChecked.length > 0 && (
            <div className="space-y-2">
              <Label>Section assignments <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <p className="text-xs text-muted-foreground">
                Restrict this person to manuscripts in a specific section. Leave blank to see all manuscripts.
              </p>
              <div className="space-y-2">
                {sectionableChecked.map((r) => (
                  <div key={r.value} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-36 shrink-0">
                      {r.label}
                    </span>
                    <select
                      name={`section_${r.value}`}
                      defaultValue={person?.role_sections?.[r.value] ?? ""}
                      className="flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                    >
                      <option value="">All manuscripts</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

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
