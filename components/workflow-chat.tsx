"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Markdown from "react-markdown"
import type { StagedMutation } from "@/app/api/admin/workflow-chat/route"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: "user" | "assistant"
  content: string
  toolUses?: { name: string; input: unknown }[]
  staged?: { mutations: StagedMutation[]; summary: string }
}

interface WorkflowChatProps {
  journalId: string
  journalName: string
  apiPath?: string
  headerLabel?: string
  placeholder?: string
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToolBadge({ name }: { name: string }) {
  const labels: Record<string, string> = {
    get_workflow: "Reading workflow",
    describe_workflow: "Describing workflow",
    list_gate_types: "Listing gate types",
    list_email_templates: "Listing templates",
    stage_mutations: "Staging changes",
    commit_mutations: "Applying changes",
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {labels[name] ?? name}
    </span>
  )
}

function StagedChanges({
  summary,
  onConfirm,
  onCancel,
  confirmed,
}: {
  summary: string
  onConfirm: () => void
  onCancel: () => void
  confirmed: boolean
}) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm space-y-3">
      <p className="font-medium text-amber-800 dark:text-amber-300">Proposed changes</p>
      <pre className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed font-mono">
        {summary}
      </pre>
      {!confirmed ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm} className="bg-amber-600 hover:bg-amber-700 text-white">
            Confirm &amp; apply
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-xs text-green-600 dark:text-green-400 font-medium">Applied</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorkflowChat({
  journalId,
  journalName,
  apiPath = "/api/admin/workflow-chat",
  headerLabel = "Workflow configuration",
  placeholder = "Describe your workflow… (Enter to send)",
}: WorkflowChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [confirmedMutations, setConfirmedMutations] = useState<Set<number>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage: Message = { role: "user", content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setIsLoading(true)

    // Flatten messages to the API shape
    const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }))

    const assistantMessage: Message = { role: "assistant", content: "", toolUses: [] }
    setMessages([...nextMessages, assistantMessage])

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, journalId }),
      })

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Process complete lines
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            setMessages((prev) => {
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }

              if (event.type === "text") {
                last.content = (last.content ?? "") + event.content
              } else if (event.type === "tool_use") {
                last.toolUses = [...(last.toolUses ?? []), { name: event.name, input: event.input }]
              } else if (event.type === "staged") {
                last.staged = { mutations: event.mutations, summary: event.summary }
              }

              updated[updated.length - 1] = last
              return updated
            })
          } catch {
            // malformed line, skip
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        }
        return updated
      })
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  function confirmMutations(messageIndex: number) {
    setConfirmedMutations((prev) => new Set([...prev, messageIndex]))
    // Send confirmation to the agent
    setInput("Yes, apply those changes.")
    // Auto-submit after state update
    setTimeout(() => {
      document.getElementById("workflow-chat-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    }, 50)
  }

  function cancelMutations() {
    setInput("Cancel those changes.")
    setTimeout(() => {
      document.getElementById("workflow-chat-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    }, 50)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {headerLabel} — {journalName}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 text-sm mt-16 max-w-sm mx-auto leading-relaxed">
            {placeholder.replace(" (Enter to send)", "")}
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {/* Tool activity badges */}
            {msg.toolUses && msg.toolUses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {msg.toolUses.map((t, j) => (
                  <ToolBadge key={j} name={t.name} />
                ))}
              </div>
            )}

            {/* Message bubble */}
            {msg.content && (
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 whitespace-pre-wrap"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Markdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ children }) => <code className="bg-zinc-200 dark:bg-zinc-700 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                      pre: ({ children }) => <pre className="bg-zinc-200 dark:bg-zinc-700 rounded p-2 text-xs font-mono overflow-x-auto mb-2">{children}</pre>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    }}
                  >
                    {msg.content}
                  </Markdown>
                ) : (
                  msg.content
                )}
                {msg.role === "assistant" && isLoading && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse align-middle" />
                )}
              </div>
            )}

            {/* Staged mutations panel */}
            {msg.staged && (
              <div className="w-full max-w-[82%]">
                <StagedChanges
                  summary={msg.staged.summary}
                  confirmed={confirmedMutations.has(i)}
                  onConfirm={() => confirmMutations(i)}
                  onCancel={cancelMutations}
                />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        id="workflow-chat-form"
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex gap-2 items-end"
      >
        <textarea
          className="flex-1 resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 min-h-[40px] max-h-[160px]"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()} size="sm">
          {isLoading ? "Thinking…" : "Send"}
        </Button>
      </form>
    </div>
  )
}
