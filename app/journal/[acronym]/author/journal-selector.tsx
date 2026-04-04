"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Journal {
  id: string
  name: string
  acronym: string
}

export function JournalSelector({ journals, current }: { journals: Journal[]; current: string }) {
  const router = useRouter()
  const currentJournal = journals.find((j) => j.acronym === current)

  return (
    <Select value={current} onValueChange={(value) => { if (value) router.push(`/journal/${value}/author`) }}>
      <SelectTrigger className="w-52 h-7 text-xs border-zinc-200 dark:border-zinc-700 bg-transparent">
        <SelectValue placeholder="Select journal…">
          {currentJournal && `${currentJournal.acronym} — ${currentJournal.name}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {journals.map((j) => (
          <SelectItem key={j.id} value={j.acronym} className="text-xs">
            {j.acronym} — {j.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
