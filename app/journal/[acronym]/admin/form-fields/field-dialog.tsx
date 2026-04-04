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
import { upsertField } from "./actions"

interface FormField {
  id: string
  field_key: string
  label: string
  description: string | null
  field_type: string
  required: boolean
  options: string[] | null
}

interface Props {
  journalId: string
  field?: FormField
}

const FIELD_TYPES = [
  { value: "boolean",  label: "Checkbox (yes/no)" },
  { value: "text",     label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select",   label: "Dropdown" },
  { value: "date",     label: "Date" },
  { value: "file",     label: "File upload" },
]

export function FieldDialog({ journalId, field }: Props) {
  const isEdit = !!field
  const [open, setOpen] = useState(false)
  const [fieldType, setFieldType] = useState(field?.field_type ?? "boolean")
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    try {
      await upsertField(journalId, formData)
      setOpen(false)
      formRef.current?.reset()
      setFieldType("boolean")
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
        {isEdit ? "Edit" : "Add field"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit field" : "Add field"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
          {isEdit && <input type="hidden" name="id" value={field.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="label">Label <span className="text-red-500">*</span></Label>
            <Input
              id="label"
              name="label"
              placeholder="Ethics approval"
              required
              defaultValue={field?.label}
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="field_key">
                Field key <span className="text-red-500">*</span>
                <span className="ml-1 font-normal text-zinc-400">(machine name, no spaces)</span>
              </Label>
              <Input
                id="field_key"
                name="field_key"
                placeholder="ethics_approval"
                required
                pattern="[a-z0-9_]+"
                title="Lowercase letters, numbers, and underscores only"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description">Help text</Label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Instructions shown below the field…"
              defaultValue={field?.description ?? ""}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="field_type">Field type <span className="text-red-500">*</span></Label>
              <select
                id="field_type"
                name="field_type"
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Required</Label>
              <div className="flex items-center gap-4 pt-2">
                {[
                  { value: "true",  label: "Yes" },
                  { value: "false", label: "No" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="required"
                      value={opt.value}
                      defaultChecked={opt.value === (field?.required ? "true" : "false")}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {fieldType === "select" && (
            <div className="space-y-1.5">
              <Label htmlFor="options">
                Options <span className="text-zinc-400 font-normal">(one per line)</span>
              </Label>
              <textarea
                id="options"
                name="options"
                rows={4}
                placeholder={"Option A\nOption B\nOption C"}
                defaultValue={field?.options?.join("\n") ?? ""}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono resize-none"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? "Save changes" : "Add field"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
