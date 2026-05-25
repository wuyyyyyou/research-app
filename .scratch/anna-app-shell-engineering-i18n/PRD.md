Status: ready-for-agent
Labels: ready-for-agent

# PRD: Engineered Anna App Shell and Bilingual UI

## Problem Statement

The current Anna Researcher app shell is maintained directly as static HTML, JavaScript, and CSS inside the committed runtime bundle. That was acceptable for the first Anna App Adapter MVP, but it is becoming a weak foundation for further UI work: app state, Anna tool calls, status rendering, report rendering, and presentation code are coupled in hand-written bundle files.

The app shell also presents its UI only in English. The user needs the Anna App Shell controls, labels, statuses, and user-facing errors to support both Chinese and English, while leaving the Research Result language strategy unchanged for now.

The current report renderer also converts markdown to HTML through hand-written string logic and raw HTML insertion. Because Research Result markdown is produced by an LLM, the frontend should move to Safe Report Markdown Rendering before the UI grows.

The user needs an Engineered Anna App Shell that remains compatible with Anna's static SPA bundle contract, but whose normal editing surface is structured frontend source rather than generated bundle files.

## Solution

Replace the hand-maintained static app shell with a Vite, React, and TypeScript frontend project that builds into the same static Anna App Shell bundle.

The built bundle remains committed so Anna App Runtime can continue loading the app without requiring a frontend dev server. The source becomes the normal editing surface, and the bundle becomes generated output.

Add Bilingual App Shell UI support with frontend-only Typed App Shell Messages. On first load, the app chooses Chinese when the browser language starts with `zh`; otherwise it chooses English. The user can switch between `中文` and `English`, and the preference is stored in browser `localStorage` without requesting Anna storage permissions.

Keep the backend and tool contract language-neutral. The Anna App Shell maps stable statuses, stages, and known error codes to localized copy in the frontend. Raw backend messages remain fallback details only.

Render Research Result markdown through a React-safe markdown renderer and continue rendering source URLs separately.

## User Stories

1. As an Anna user, I want the research app UI to appear in Chinese when my browser language is Chinese, so that the app feels natural on first load.
2. As an Anna user, I want the research app UI to appear in English when my browser language is not Chinese, so that the default language remains broadly usable.
3. As an Anna user, I want to switch the UI between `中文` and `English`, so that I can choose the language I prefer.
4. As an Anna user, I want my UI language choice remembered locally, so that I do not need to switch languages every time I reopen the app.
5. As an Anna user, I want the query form labels and controls localized, so that I can understand the input workflow in either language.
6. As an Anna user, I want optional domain filter labels localized, so that advanced input remains understandable.
7. As an Anna user, I want submit and busy-state button text localized, so that the app communicates clearly while research is running.
8. As an Anna user, I want research status text localized, so that I can understand the current progress stage.
9. As an Anna user, I want known error states localized, so that configuration and runtime problems are easier to understand.
10. As an Anna user, I want raw backend error details still available when needed, so that technical failures are not hidden by generic localized text.
11. As an Anna user, I want completed reports to render as readable markdown, so that headings, lists, and links are easy to inspect.
12. As an Anna user, I want report source URLs rendered separately from the report body, so that evidence remains easy to scan.
13. As an Anna user, I want changing the UI language not to change the generated report language, so that this first phase does not create hidden prompt behavior.
14. As an Anna user, I want the existing research workflow to remain unchanged, so that the frontend refactor does not alter how jobs start, advance, and complete.
15. As an Anna App developer, I want frontend code organized as source modules, so that changes are easier to review than direct edits to a large bundle script.
16. As an Anna App developer, I want the static Anna bundle to remain committed, so that Anna App Runtime can load the app without a build step at runtime.
17. As an Anna App developer, I want a normal build command to regenerate the static bundle, so that source changes have a repeatable output.
18. As an Anna App developer, I want build scripts not to start Anna runtime, so that normal frontend development and CI do not require Anna App dev.
19. As an Anna App developer, I want Anna tool API calls isolated in an API wrapper, so that UI components do not construct tool payloads directly.
20. As an Anna App developer, I want research job state isolated in hooks or state modules, so that polling, busy state, result loading, and error handling can be tested separately.
21. As an Anna App developer, I want locale detection and message lookup isolated in an i18n module, so that bilingual behavior is consistent across components.
22. As an Anna App developer, I want stable typed message keys, so that missing Chinese or English copy is caught while developing.
23. As an Anna App developer, I want simple interpolation support in messages, so that counts, stages, and dynamic labels can be localized without ad hoc string concatenation.
24. As an Anna App developer, I want status, stage, and error-code localization centralized, so that backend protocol values remain stable and language-neutral.
25. As an Anna App developer, I want report rendering handled by a React markdown component, so that the app does not use raw HTML injection for LLM-produced content.
26. As an Anna App developer, I want shared TypeScript types for tool actions, job status, stages, and results, so that API and UI code stay aligned.
27. As an Anna App developer, I want presentation components split by responsibility, so that the form, status panel, report view, source list, and language toggle can evolve independently.
28. As an Anna App developer, I want the first phase to avoid a full i18n framework, so that the scope stays small for two local UI languages.
29. As an Anna App developer, I want the manifest and Anna runtime contract to remain unchanged, so that the frontend refactor does not force backend or packaging changes.
30. As a future developer, I want the app shell source organization to support more UI features later, so that report history, retries, exports, and richer views can be added without rewriting the app shell again.

## Implementation Decisions

- Build an Engineered Anna App Shell using Vite, React, and TypeScript.
- Preserve the Anna static SPA runtime contract: Anna continues to load a built static bundle.
- Commit both the frontend source and the built Committed App Shell Bundle.
- Treat source as the normal editing surface and the bundle as generated output.
- Do not hand-edit generated bundle files in the normal workflow.
- Add npm-based frontend scripts for build and optional frontend-only development.
- Do not make normal scripts start Anna App Runtime or Anna App dev.
- Keep the existing Anna App manifest entry behavior stable.
- Keep the existing Research Tool Dispatcher protocol unchanged.
- Keep the existing Anna App Shell flow: start an Async Research Job, advance/poll it, read status, and read the Research Result.
- Keep Bilingual App Shell UI scope frontend-only.
- Do not add a locale field to the tool contract.
- Do not change Anna Research Orchestrator prompts or report language strategy in this phase.
- Use App Shell Locale Preference: detect browser language on first load, allow manual switching, and persist the selected UI locale in browser `localStorage`.
- Do not request Anna storage permissions for locale persistence.
- Use Typed App Shell Messages rather than a full i18n framework.
- Use stable message keys shared by Chinese and English dictionaries.
- TypeScript should make missing dictionary keys visible during development.
- Support simple interpolation in localized messages.
- Implement Localized Status Mapping in the frontend for stable job statuses, orchestrator stages, and known error codes.
- Use raw backend messages only as fallback details or technical context.
- Keep backend responses language-neutral.
- Split the app shell source along App Shell Frontend Boundaries:
  - Anna tool API wrapper.
  - Research job state and polling logic.
  - i18n detection, persistence, message lookup, and status mapping.
  - Presentation components for form, status, report, sources, and language toggle.
  - Shared TypeScript types for tool actions, jobs, stages, errors, and results.
- Use Safe Report Markdown Rendering with a React-safe markdown renderer.
- Do not use raw HTML insertion for Research Result markdown.
- Continue rendering source URLs through a dedicated source list rather than relying on report body HTML.
- Keep the first phase focused on maintainability, static build output, bilingual UI, and safe markdown rendering.

## Testing Decisions

- Tests should assert user-visible behavior and stable module contracts, not private component implementation details.
- The frontend build should be testable without starting Anna App dev.
- Existing Python Executa tests should continue to pass unchanged unless a legitimate contract mismatch is discovered.
- Add frontend tests around locale detection:
  - Chinese browser language defaults to Chinese.
  - Non-Chinese browser language defaults to English.
  - Stored local preference overrides browser language.
- Add frontend tests around language switching and local persistence.
- Add tests that verify Chinese and English message dictionaries expose the same typed keys.
- Add tests for simple message interpolation.
- Add tests for Localized Status Mapping across known job statuses, orchestrator stages, and known error codes.
- Add tests for fallback behavior when the frontend receives an unknown status, stage, or error code.
- Add tests for the Anna tool API wrapper using a fake host API, verifying call shapes for start, advance, status, and result.
- Add tests for research job state behavior using a fake API:
  - Start creates or observes a job.
  - Polling advances work through repeated calls.
  - Completed jobs load the result.
  - Failures surface localized user-facing errors.
- Add rendering tests for the report view to verify markdown content is displayed through React rendering.
- Add a regression test or static check that the frontend does not use raw HTML insertion for report markdown.
- Add component tests for the language toggle, research form, status panel, report view, and source list where behavior is user-visible.
- Keep live Anna runtime smoke testing manual unless the user explicitly starts Anna App dev.

## Out of Scope

- Changing Research Result language policy.
- Localizing backend prompts.
- Adding a backend locale field or locale-dependent tool responses.
- Requesting Anna storage permissions for language preference.
- Replacing the Research Tool Dispatcher contract.
- Changing the Anna Research Orchestrator stages.
- Adding report type selection.
- Adding report history, cancellation, retry orchestration, exports, follow-up chat, or multi-job management.
- Adding a full i18n framework, remote language packs, or translation management service.
- Changing Tavily, Anna Sampling LLM, Context Selector, or report generation behavior.
- Starting Anna App dev or making Anna runtime startup part of the build/test workflow.

## Further Notes

- This PRD intentionally follows the user's selected option: first implement UI bilingual support only and do not alter the generated report language strategy.
- The main engineering goal is to move the app shell from a hand-maintained bundle to a source-managed frontend while preserving Anna's static bundle loading behavior.
- The main safety improvement is replacing hand-written markdown-to-HTML rendering with Safe Report Markdown Rendering for LLM-generated reports.
- The user has requested that agents do not start Anna App dev themselves. If runtime verification is needed, ask the user to start it.
