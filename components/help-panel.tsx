"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import ReactMarkdown from "react-markdown"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function HelpPanel() {
  const pathname = usePathname()
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const loadGuide = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/help?pathname=${encodeURIComponent(pathname)}`)
      const data = await res.json()
      setContent(data.content)
    } catch {
      setContent("# Help\n\nUnable to load guide.")
    } finally {
      setLoading(false)
    }
  }, [pathname])

  useEffect(() => {
    if (open) loadGuide()
  }, [open, loadGuide])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex items-center justify-center w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-xs font-medium"
          aria-label="Help"
        >
          ?
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[480px] sm:w-[520px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-base">Help</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
            Loading…
          </div>
        ) : (
          <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none
            prose-headings:font-semibold prose-headings:tracking-tight
            prose-h1:text-xl prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-sm prose-h3:mt-6
            prose-p:text-zinc-600 dark:prose-p:text-zinc-400 prose-p:leading-relaxed
            prose-li:text-zinc-600 dark:prose-li:text-zinc-400
            prose-a:text-indigo-600 dark:prose-a:text-indigo-400
            prose-table:text-sm prose-td:py-1.5 prose-th:py-1.5
            prose-hr:border-zinc-100 dark:prose-hr:border-zinc-800
            prose-code:text-xs prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded
          ">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
