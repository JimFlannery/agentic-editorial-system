import { Chat } from "@/components/chat";

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center gap-3">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          TRAINS
        </span>
        <span className="text-xs text-zinc-400 hidden sm:block">
          Tailwind · React · AI · Next.js · Shadcn
        </span>
        <span className="ml-auto text-xs text-zinc-400">
          Powered by Claude
        </span>
      </header>
      <main className="flex-1 overflow-hidden max-w-3xl w-full mx-auto flex flex-col">
        <Chat />
      </main>
    </div>
  );
}
