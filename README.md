# TRAINS Stack

**T-R-AI-N-S** — A modern stack for AI-augmented web development simplifying integration of AI-powered features.

| Letter | Technology | Version |
|--------|-----------|---------|
| **T** | [Tailwind CSS](https://tailwindcss.com) | v4 |
| **R** | [React](https://react.dev) | v19 |
| **AI** | [Claude (Anthropic)](https://docs.anthropic.com) | claude-opus-4-6 |
| **N** | [Next.js](https://nextjs.org) | v16 |
| **S** | [Shadcn/ui](https://ui.shadcn.com) | v4 |

---

## Why TRAINS?

Each technology in this stack becomes more powerful with AI assistance:

- **Tailwind CSS** — Utility-first CSS that pairs naturally with AI code generation. Describe a layout, get Tailwind classes. No mental overhead switching between stylesheets and components.
- **React** — The industry-standard component model. Mature, well-documented, and the target of virtually every AI coding assistant's training data.
- **AI** — Claude (Anthropic) is wired in via `@anthropic-ai/sdk`. The streaming chat API lives at `app/api/chat/route.ts`. Claude Opus 4.6 with adaptive thinking is the default model — swap it or add tools in one file.
- **Next.js** — Full-stack React framework with App Router, Server Components, and built-in API routes. Mature, production-ready, and backed by Vercel.
- **Shadcn/ui** — A collection of beautifully designed, accessible components built on Radix/Base UI primitives and styled with Tailwind. Unlike a traditional component library, you own the source — AI can read and modify it directly.

---

## Shadcn Components

Shadcn/ui components are added to your project individually — you own the source code in `components/ui/`. Browse the full component catalog here:

**[https://ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components)**

Add a component with the Shadcn CLI:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
# etc.
```

Currently installed components:

- `components/ui/button.tsx` — Button with size and style variants

---

## Claude AI

This project ships with Claude fully wired up — a working streaming chat UI is on the home page.

### Setup

```bash
# Add your API key to .env.local file
ANTHROPIC_API_KEY=your_api_key_here
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### How it works

| File | Role |
|------|------|
| `app/api/chat/route.ts` | Next.js Route Handler — streams Claude responses |
| `components/chat.tsx` | Client component — chat UI with streaming support |
| `app/page.tsx` | Home page — renders `<Chat />` |

**Model:** `claude-opus-4-6` with `thinking: { type: "adaptive" }` (Anthropic's most capable model with adaptive reasoning).

To change the model, system prompt, or add tools, edit [app/api/chat/route.ts](app/api/chat/route.ts).

**Anthropic SDK docs:** [docs.anthropic.com](https://docs.anthropic.com)

---

## Project Structure

```
├── app/
│   ├── api/chat/route.ts # Claude streaming API route
│   ├── globals.css       # Tailwind v4 global styles
│   ├── layout.tsx        # Root layout (Geist font)
│   └── page.tsx          # Home page — renders <Chat />
├── components/
│   ├── chat.tsx          # Chat UI client component
│   └── ui/               # Shadcn components (you own these)
├── lib/
│   └── utils.ts          # cn() helper (tailwind-merge + clsx)
├── CLAUDE.md             # Claude Code project guide
├── components.json       # Shadcn configuration
└── next.config.ts        # Next.js configuration
```

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see a working Claude chat interface.

---

## Notes

- Next.js is installed with the App Router, which uses a separate directory for each page. This allows for a new CLAUDE.md to be added to each directory to give granular instructions to Claude
about how each page should work and what it should do. 
**Installed MCP Servers** (configured in `.mcp.json`):

- [Shadcn MCP Server](https://github.com/ahonn/mcp-server-shadcn) — Gives Claude direct access to the Shadcn/ui component registry. Claude can browse, search, and view component examples without leaving the editor.
- [Context7 MCP](https://github.com/upstash/context7) — Fetches up-to-date documentation for Next.js, React, Tailwind, and Shadcn on demand. Prevents Claude from generating code against outdated APIs (critical since all four core libraries are recent major versions).
- [Puppeteer MCP Server](https://github.com/merajmehrabi/puppeteer-mcp-server) — Lets Claude navigate the running app, click buttons, fill forms, and take screenshots. Closes the loop on feature verification so Claude can confirm things actually work end-to-end.

**Additional MCP Servers to consider** depending on your project's needs:

- [GitHub MCP](https://github.com/github/github-mcp-server) — Useful if you're using GitHub for issues and PRs. Lets Claude create issues, open PRs, and read comments without leaving the editor. Most valuable once the project has a team or a growing backlog.
- [Figma MCP](https://github.com/GLips/Figma-Context-MCP) — Strong fit for Tailwind + Shadcn workflows. If designs live in Figma, Claude can read component specs and translate them directly into Tailwind classes and Shadcn primitives.
- [Vercel MCP](https://vercel.com/blog/vercel-mcp-server) — Lets Claude check deployment status, manage environment variables, and read logs without leaving the editor. Most useful once the project is deployed.
- [Storybook MCP](https://storybook.js.org/blog/storybook-mcp) — Useful for component-heavy projects that use Storybook for isolated component development and documentation. Less necessary if Shadcn covers your component needs.
- **Database MCPs** (e.g. [Postgres](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres), [Supabase](https://github.com/supabase-community/supabase-mcp)) — Only relevant once the project adds a persistent data layer.

## Tech References

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Anthropic Console](https://console.anthropic.com) (API keys)
- [Lucide Icons](https://lucide.dev) (included)

## Deploy

The easiest deployment target is [Vercel](https://vercel.com/new) — zero-config for Next.js apps.

See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for other options.
