<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Durable Context

- Keep project handoff notes in `handoff.md` when work spans multiple turns or changes app behavior.
- Keep user-facing setup and workflow assumptions current in `README.md`.
- Prefer saved files, tests, and commits over chat-only state. If a commit is not made, leave the working tree files saved and summarize `git status`.
