"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { reorderFields, toggleField } from "./actions"
import { FieldDialog } from "./field-dialog"

interface FormField {
  id: string
  field_key: string
  label: string
  description: string | null
  field_type: string
  required: boolean
  active: boolean
  options: string[] | null
}

const TYPE_LABELS: Record<string, string> = {
  boolean:  "Checkbox",
  text:     "Short text",
  textarea: "Long text",
  select:   "Dropdown",
  date:     "Date",
  file:     "File upload",
}

function SortableRow({ field, journalId }: { field: FormField; journalId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 ${
        isDragging ? "shadow-lg rounded-lg z-10" : ""
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${field.active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500 line-through"}`}>
            {field.label}
          </span>
          {field.required && (
            <span className="text-xs text-red-500">required</span>
          )}
        </div>
        {field.description && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{field.description}</p>
        )}
      </div>

      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 font-mono w-20 text-right">
        {field.field_key}
      </span>

      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 w-20 text-right">
        {TYPE_LABELS[field.field_type] ?? field.field_type}
      </span>

      <div className="shrink-0 flex items-center gap-3">
        <button
          onClick={() => toggleField(field.id, journalId, !field.active)}
          className={`text-xs transition-colors ${
            field.active
              ? "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              : "text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400"
          }`}
        >
          {field.active ? "Disable" : "Enable"}
        </button>
        <FieldDialog journalId={journalId} field={field} />
      </div>
    </li>
  )
}

export function FieldList({ fields, journalId }: { fields: FormField[]; journalId: string }) {
  const [items, setItems] = useState(fields)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((f) => f.id === active.id)
    const newIndex = items.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    await reorderFields(journalId, reordered.map((f) => f.id))
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 px-4 py-8 text-center">
        No fields yet. Add your first field above.
      </p>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((field) => (
            <SortableRow key={field.id} field={field} journalId={journalId} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
