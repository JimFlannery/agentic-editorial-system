"use client"

interface Journal {
  id: string
  name: string
  acronym: string
}

export function JournalSelector({ journals, current }: { journals: Journal[]; current: string }) {
  return (
    <select
      className="appearance-none text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-transparent border-none cursor-pointer focus:outline-none"
      value={current}
      onChange={(e) => { window.location.href = `/journal/${e.target.value}/admin` }}
    >
      {journals.map((j) => (
        <option key={j.id} value={j.acronym}>{j.acronym} — {j.name}</option>
      ))}
    </select>
  )
}
