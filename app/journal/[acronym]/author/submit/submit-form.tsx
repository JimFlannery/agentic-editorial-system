"use client"

import { useState } from "react"

interface CoAuthor {
  name: string
  email: string
  orcid: string
}

interface ManuscriptType {
  id: string
  name: string
  description: string | null
}

interface FormField {
  id: string
  field_key: string
  label: string
  description: string | null
  field_type: string
  required: boolean
  options: string[] | null
  conditions: { show_if?: { field: string; value: string } } | null
}

interface Props {
  manuscriptTypes: ManuscriptType[]
  formFields: FormField[]
  action: (formData: FormData) => Promise<void>
}

function FieldInput({ field }: { field: FormField }) {
  const base = "w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"

  switch (field.field_type) {
    case "boolean":
      return (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name={field.field_key}
            className="mt-0.5 rounded border-zinc-300"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{field.label}</span>
        </label>
      )

    case "textarea":
      return (
        <textarea
          name={field.field_key}
          required={field.required}
          rows={4}
          className={`${base} resize-y`}
          placeholder={field.description ?? ""}
        />
      )

    case "select":
      return (
        <select
          name={field.field_key}
          required={field.required}
          className={base}
          defaultValue=""
        >
          <option value="" disabled>Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case "date":
      return (
        <input
          type="date"
          name={field.field_key}
          required={field.required}
          className={base}
        />
      )

    case "file":
      return (
        <input
          type="file"
          name={field.field_key}
          required={field.required}
          className="text-sm text-zinc-600 dark:text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 dark:file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 dark:file:text-zinc-300"
        />
      )

    default:
      return (
        <input
          type="text"
          name={field.field_key}
          required={field.required}
          className={base}
        />
      )
  }
}

function DynamicField({ field, manuscriptType }: { field: FormField; manuscriptType: string }) {
  // Evaluate show_if condition
  if (field.conditions?.show_if) {
    const { field: condField, value: condValue } = field.conditions.show_if
    if (condField === "manuscript_type" && manuscriptType !== condValue) return null
  }

  if (field.field_type === "boolean") {
    return (
      <div>
        <FieldInput field={field} />
        {field.description && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 ml-6">{field.description}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {field.description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{field.description}</p>
      )}
      <FieldInput field={field} />
    </div>
  )
}

export function SubmitForm({ manuscriptTypes, formFields, action }: Props) {
  const [manuscriptType, setManuscriptType] = useState(manuscriptTypes[0]?.name ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([])

  function addCoAuthor() {
    setCoAuthors((prev) => [...prev, { name: "", email: "", orcid: "" }])
  }

  function removeCoAuthor(index: number) {
    setCoAuthors((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCoAuthor(index: number, field: keyof CoAuthor, value: string) {
    setCoAuthors((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      await action(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.")
      setSubmitting(false)
    }
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Tier 1: always-present fields ── */}
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Manuscript type <span className="text-red-500">*</span>
          </label>
          {manuscriptTypes.length === 0 ? (
            <p className="text-sm text-zinc-400">No manuscript types configured for this journal.</p>
          ) : (
            <select
              name="manuscript_type"
              required
              value={manuscriptType}
              onChange={(e) => setManuscriptType(e.target.value)}
              className={inputCls}
            >
              {manuscriptTypes.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          )}
          {manuscriptTypes.find((t) => t.name === manuscriptType)?.description && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {manuscriptTypes.find((t) => t.name === manuscriptType)!.description}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            className={inputCls}
            placeholder="Full title of your manuscript"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Abstract <span className="text-red-500">*</span>
          </label>
          <textarea
            name="abstract"
            required
            rows={6}
            className={`${inputCls} resize-y`}
            placeholder="Structured or unstructured abstract"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Manuscript file <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
            PDF, Word (.docx), or LaTeX (.zip). Max 50 MB.
          </p>
          <input
            type="file"
            name="manuscript_file"
            required
            accept=".pdf,.doc,.docx,.zip,.tex"
            className="text-sm text-zinc-600 dark:text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 dark:file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 dark:file:text-zinc-300"
          />
        </div>
      </div>

      {/* ── Co-authors ── */}
      <hr className="border-zinc-200 dark:border-zinc-800" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Co-authors</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              You are the corresponding author. Add any additional authors below.
            </p>
          </div>
          <button
            type="button"
            onClick={addCoAuthor}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            + Add co-author
          </button>
        </div>

        {/* Hidden count field so the action knows how many to parse */}
        <input type="hidden" name="coauthor_count" value={coAuthors.length} />

        {coAuthors.length === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No co-authors added.</p>
        )}

        {coAuthors.map((author, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Co-author {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeCoAuthor(i)}
                className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name={`coauthor_name_${i}`}
                  value={author.name}
                  onChange={(e) => updateCoAuthor(i, "name", e.target.value)}
                  required
                  placeholder="Dr. Jane Smith"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name={`coauthor_email_${i}`}
                  value={author.email}
                  onChange={(e) => updateCoAuthor(i, "email", e.target.value)}
                  required
                  placeholder="jane@example.com"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="sm:w-1/2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                ORCID
              </label>
              <input
                type="text"
                name={`coauthor_orcid_${i}`}
                value={author.orcid}
                onChange={(e) => updateCoAuthor(i, "orcid", e.target.value)}
                placeholder="0000-0000-0000-0000"
                className={inputCls}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Tier 2: journal-configured fields ── */}
      {formFields.length > 0 && (
        <>
          <hr className="border-zinc-200 dark:border-zinc-800" />
          <div className="space-y-5">
            {formFields.map((field) => (
              <DynamicField key={field.id} field={field} manuscriptType={manuscriptType} />
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          You can track your submission from the Author Center after submitting.
        </p>
        <button
          type="submit"
          disabled={submitting || manuscriptTypes.length === 0}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-5 py-2.5 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit manuscript"}
        </button>
      </div>
    </form>
  )
}
