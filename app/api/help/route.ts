import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const GUIDE_MAP: Record<string, string> = {
  author:            "author.md",
  reviewer:          "reviewer.md",
  "assistant-editor": "assistant-editor.md",
  editor:            "editor.md",
  "editor-in-chief": "editor-in-chief.md",
  "editorial-support": "editorial-support.md",
}

function guideForPathname(pathname: string): string {
  if (pathname.includes("/reviewer"))          return "reviewer.md"
  if (pathname.includes("/author"))            return "author.md"
  if (pathname.includes("/editor-in-chief"))   return "editor-in-chief.md"
  if (pathname.includes("/editorial-support")) return "editorial-support.md"
  if (pathname.includes("/assistant-editor"))  return "assistant-editor.md"
  if (pathname.includes("/editor"))            return "editor.md"
  if (pathname.includes("/editorial"))         return "assistant-editor.md"
  return "author.md"
}

export async function GET(req: NextRequest) {
  const pathname = req.nextUrl.searchParams.get("pathname") ?? ""
  const role     = req.nextUrl.searchParams.get("role")
  const filename = role && GUIDE_MAP[role] ? GUIDE_MAP[role] : guideForPathname(pathname)
  const filePath = path.join(process.cwd(), "docs", "user-guide", filename)

  try {
    const content = fs.readFileSync(filePath, "utf-8")
    return NextResponse.json({ content, guide: filename.replace(".md", "") })
  } catch {
    return NextResponse.json({ content: "# Help\n\nNo guide found for this page.", guide: "help" })
  }
}
