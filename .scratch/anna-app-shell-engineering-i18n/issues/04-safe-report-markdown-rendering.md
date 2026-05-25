Status: ready-for-agent
Labels: ready-for-agent

# Safe Report Markdown Rendering

## Parent

Engineered Anna App Shell and Bilingual UI PRD

## What to build

Replace the app shell's hand-written markdown-to-HTML rendering path with Safe Report Markdown Rendering. The user should see completed Research Result markdown rendered through React components, while source URLs continue to be rendered separately in the SourceList.

This slice should remove the raw HTML insertion path for LLM-produced report markdown and add regression coverage so future changes do not reintroduce unsafe report rendering.

## Acceptance criteria

- [ ] Research Result markdown is rendered with a React-safe markdown renderer.
- [ ] The app shell does not use raw HTML insertion for report markdown.
- [ ] The old hand-written markdown-to-HTML conversion path is removed from the app shell.
- [ ] Markdown headings, paragraphs, lists, emphasis, code, and links render readably in the report view.
- [ ] Report source URLs are still rendered separately by the source list.
- [ ] Source links open safely with appropriate external-link attributes.
- [ ] Empty report and not-ready states remain localized through the app shell message system.
- [ ] Rendering a report does not alter the Research Tool Dispatcher contract.
- [ ] Frontend tests verify representative markdown rendering behavior.
- [ ] A regression test or static check verifies report markdown is not rendered through raw HTML injection.
- [ ] Existing result loading and source display behavior remains unchanged.

## Blocked by

- 01-engineered-app-shell-equivalent-migration
- 02-typed-app-shell-messages-and-locale-preference
