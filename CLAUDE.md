# TRAINS Stack — Claude Code Guide

This is a **TRAINS** stack project: **T**ailwind · **R**eact · **AI** · **N**ext.js · **S**hadcn

## Stack Versions

| Tech | Version |
|------|---------|
| Next.js | 16 (App Router) |
| React | 19 |
| Tailwind CSS | v4 |
| Shadcn/ui | v4 |
| Anthropic SDK | latest |

---

## Project Structure

```
app/
  api/chat/route.ts   # Claude streaming API route (POST /api/chat)
  globals.css         # Tailwind v4 global styles
  layout.tsx          # Root layout
  page.tsx            # Home page — renders <Chat />
components/
  chat.tsx            # Chat UI client component
  ui/
    button.tsx        # Shadcn Button component
lib/
  utils.ts            # cn() helper (tailwind-merge + clsx)
```

---

## Key Conventions

### Styling
- Use **Tailwind utility classes** directly in JSX — no separate CSS files for component styles
- Use the `cn()` helper from `@/lib/utils` to merge conditional classes:
  ```ts
  import { cn } from "@/lib/utils"
  cn("base-class", condition && "conditional-class")
  ```
- Dark mode uses the `dark:` variant — the app supports light and dark out of the box

### Components
- Shadcn/ui components live in `components/ui/` — you own the source, edit freely
- Add new Shadcn components with: `npx shadcn@latest add <component-name>`
- Browse all available components: https://ui.shadcn.com/docs/components
- Use `"use client"` at the top of any component that uses hooks or browser APIs

### Imports
Path aliases are configured in `tsconfig.json`:
- `@/components/...` → `components/`
- `@/lib/...` → `lib/`
- `@/ui/...` → `components/ui/`

### API Routes
- All API routes live under `app/api/`
- The Claude chat route is at `app/api/chat/route.ts` and streams responses

---

## Claude API Integration

**Model:** `claude-opus-4-6` with `thinking: { type: "adaptive" }`

**Pattern:** The chat UI (`components/chat.tsx`) sends `POST /api/chat` with the full message history. The route streams back plain text chunks using the Anthropic SDK's streaming API.

**Adding tools or changing the system prompt:** Edit `app/api/chat/route.ts`.

**Env var required:**
```
ANTHROPIC_API_KEY=sk-ant-...
```
Get a key at https://console.anthropic.com — add it to `.env.local` (already gitignored).

---

## Common Tasks

| Task | Command / Location |
|------|--------------------|
| Run dev server | `npm run dev` |
| Add a Shadcn component | `npx shadcn@latest add <name>` |
| Change Claude model | `app/api/chat/route.ts` → `model` field |
| Change system prompt | `app/api/chat/route.ts` → `system` field |
| Add a new page | Create `app/<route>/page.tsx` |
| Add a new API route | Create `app/api/<route>/route.ts` |
