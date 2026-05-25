Status: ready-for-agent
Labels: ready-for-agent

# PRD: Anna App Adapter MVP for GPT Researcher

## Problem Statement

The current GPT Researcher project is an open-source web research application built around its own backend, frontend, WebSocket progress stream, external LLM configuration, external embedding configuration, and multiple report modes. That shape does not fit Anna App usage.

The user needs a first migration stage that proves GPT Researcher can run as an Anna App: a static single-page Anna App Shell should call an Executa Wrapper through Anna host APIs, the wrapper should use Anna Sampling LLM instead of owning an external chat LLM key, and the first result should be a standard `research_report`.

The first stage must avoid a full feature-equivalent rewrite. It should establish a stable Anna-compatible architecture that can later add richer retrieval, local embeddings, report exports, history, cancellation, and additional report types without undoing the first slice.

## Solution

Build an Anna App Adapter MVP with a Single-Page Research Workbench and a Python Executa Wrapper exposing a Research Tool Dispatcher. The app starts an Async Research Job, advances it through bounded stages with repeated short invocations, and reads status/result through the same dispatcher.

The backend flow is an Anna Research Orchestrator, not a direct invocation of the original monolithic GPT Researcher runtime. It selectively reuses GPT Researcher concepts, prompts, and retrieval ideas while respecting Anna protocol constraints:

- Anna Sampling LLM is used for chat-completion steps.
- Tavily Required Credential is used for web retrieval.
- Tavily Summary Retrieval is used instead of browser scraping.
- Lexical Context Selector is used instead of OpenAI embeddings.
- Minimal Research Result returns markdown report and source URL evidence.
- Research Report Only is supported in the first stage.

The first-stage state machine is:

```text
created
-> select_role
-> plan_queries
-> search_next_query
-> select_context
-> write_report
-> completed
```

Each `advance` invocation performs one bounded stage or one bounded unit within a stage. Stages that use Anna Sampling LLM run inside the current Anna invocation so they receive the current `invoke_id` and comply with Anna Sampling limits.

## User Stories

1. As an Anna user, I want to open a GPT Researcher-style Anna App, so that I can run web research without leaving Anna.
2. As an Anna user, I want to enter a research query, so that I can request a standard research report.
3. As an Anna user, I want the first version to support only `research_report`, so that the workflow stays simple and predictable.
4. As an Anna user, I want the app to show that research has started, so that I know my request was accepted.
5. As an Anna user, I want the app to show the current research stage, so that I can understand whether it is selecting a role, planning queries, searching, selecting context, or writing.
6. As an Anna user, I want the app to keep progressing while I wait, so that a multi-minute research task does not need one long blocking call.
7. As an Anna user, I want the app to display a markdown report when complete, so that I can read the result directly in the Anna App Shell.
8. As an Anna user, I want source URLs shown with the report, so that I can inspect the evidence behind the answer.
9. As an Anna user, I want clear failure messages when configuration is missing, so that I know when the Tavily credential or sampling grant needs attention.
10. As an Anna user, I want domain filtering as an optional constraint, so that I can focus research on specific websites or domains.
11. As an Anna user, I do not want to provide source URLs in the first version, so that the app does not imply it has read pages that it does not actually scrape.
12. As an Anna user, I want the app to avoid external chat LLM keys, so that model routing, billing, and quota stay under Anna.
13. As an Anna user, I want the first version to avoid OpenAI embeddings, so that I do not need to configure a second external AI provider.
14. As an Anna user, I want the workflow to work with Tavily and Anna Sampling only, so that initial setup is small.
15. As an Anna user, I want the app to recover gracefully from malformed LLM planning output, so that research can continue with the original query.
16. As an Anna user, I want research to be single-active-job in the MVP, so that the interface and local state are easy to reason about.
17. As an Anna user, I want starting a new job while one is active to report the current active job, so that I do not accidentally create parallel runs.
18. As an Anna user, I want the current job to be stored locally, so that polling invocations can read consistent status and results.
19. As an Anna user, I want the app to use Anna App Runtime APIs rather than GPT Researcher's old HTTP/WebSocket backend, so that it behaves like a native Anna App.
20. As an Anna user, I want a quiet single-page workbench instead of the original full dashboard, so that the first version is focused on the main research task.
21. As an Anna user, I want the app to avoid PDF and DOCX exports in the first version, so that the first slice focuses on the web-to-report loop.
22. As an Anna user, I want the app to avoid follow-up chat in the first version, so that report generation remains the main workflow.
23. As an Anna App developer, I want the Executa Wrapper to expose one dispatcher tool, so that Anna App Shell calls have a stable method and action shape.
24. As an Anna App developer, I want tool actions limited to `start`, `advance`, `get_status`, and `get_result`, so that the first tool contract is small and testable.
25. As an Anna App developer, I want protocol stdout reserved for JSON-RPC frames, so that Executa communication remains valid.
26. As an Anna App developer, I want logs written to stderr, so that debugging output cannot corrupt JSON-RPC responses.
27. As an Anna App developer, I want credentials to come from `context.credentials` with an environment fallback, so that production and local development both work.
28. As an Anna App developer, I want the manifest to declare Tavily as a required credential, so that missing search configuration is surfaced before research work begins.
29. As an Anna App developer, I want the manifest to declare Anna Sampling capability, so that host LLM sampling is negotiated explicitly.
30. As an Anna App developer, I want the wrapper to handle `initialize`, so that protocol v2 sampling can be used.
31. As an Anna App developer, I want each sampling call to echo the current invoke identifier, so that Anna can attribute usage correctly.
32. As an Anna App developer, I want sampling failures returned as tool errors or failed job states, so that the UI can display actionable messages.
33. As an Anna App developer, I want the Anna Research Orchestrator to be a deep module, so that the state machine can be tested without the browser UI.
34. As an Anna App developer, I want the Context Selector to be a deep module, so that the first Lexical Context Selector can later be swapped for local embeddings.
35. As an Anna App developer, I want raw search results and selected context stored separately, so that future context selector changes do not require changing the whole job model.
36. As an Anna App developer, I want Tavily search behavior isolated behind a small retrieval interface, so that future raw-content extraction or other search providers can be added later.
37. As an Anna App developer, I want result serialization isolated, so that large-response file transport or export formats can be introduced later.
38. As an Anna App developer, I want the SPA polling loop to call `advance`, so that the UI participates in safely moving the job through short Anna invocations.
39. As an Anna App developer, I want `get_status` to be read-only, so that status reads do not unexpectedly consume sampling or Tavily quota.
40. As an Anna App developer, I want `get_result` to be read-only, so that completed reports can be displayed without changing job state.
41. As an Anna App developer, I want invalid action names to return clear invalid-parameter errors, so that bad app/tool wiring is easy to diagnose.
42. As an Anna App developer, I want malformed job records to fail predictably, so that local state corruption does not produce misleading reports.
43. As a future developer, I want report generation prompts to stay compatible with GPT Researcher terminology, so that later migration can reuse more of the original engine.
44. As a future developer, I want local embedding support to be a Context Selector replacement, so that future semantic retrieval does not require changing Anna App Shell or tool actions.
45. As a future developer, I want browser scraping to be deferred behind retrieval/context boundaries, so that adding it later does not rewrite the MVP workflow.
46. As a future developer, I want additional report types to remain out of the MVP, so that each can be added as an explicit later feature.

## Implementation Decisions

- Build an Anna App Adapter MVP rather than a full Anna-native rewrite.
- Build a static Anna App Shell as a Single-Page Research Workbench.
- Build an Executa Wrapper that speaks JSON-RPC over stdio and exposes one Research Tool Dispatcher.
- The Research Tool Dispatcher uses Core Research Actions: `start`, `advance`, `get_status`, and `get_result`.
- `start` creates an Async Research Job and returns a research identifier.
- `advance` moves an Invoke-Advanced Research Job through a bounded stage.
- `get_status` reads current job status without advancing work.
- `get_result` reads the Minimal Research Result after completion.
- The MVP follows Single Active Job semantics.
- The job store is local to the Executa Wrapper and is not read directly by the Anna App Shell.
- Job records store original input, current status, current stage, timestamps, search queries, search results, selected context, report markdown, source URLs, and error summary.
- The Executa Wrapper declares Tavily Required Credential in its manifest.
- The Executa Wrapper reads Tavily credentials from Anna-injected context credentials and falls back to local environment variables for development.
- The Executa Wrapper negotiates protocol v2 and declares Anna Sampling LLM capability.
- The Executa Wrapper uses Anna Sampling LLM for Adaptive Research Role, Bounded Query Planning, and final report writing.
- Each Anna Sampling LLM call must run inside a current invoke and include the current invoke identifier in metadata.
- Do not implement a full LangChain provider in the MVP.
- Do not proxy Anna Sampling through OpenAI-compatible environment variables.
- Do not directly invoke the original monolithic GPT Researcher runtime in the MVP.
- Build an Anna Research Orchestrator that selectively reuses GPT Researcher ideas and prompt assets.
- Keep Adaptive Research Role as a separate orchestrator stage.
- Keep Bounded Query Planning as a separate orchestrator stage.
- Limit query planning to a small structured set of search queries and always retain the original query.
- If planning output is invalid, fall back to the original query.
- Use Tavily Summary Retrieval for web retrieval.
- Do not independently scrape each Tavily result page in the MVP.
- Do not support arbitrary source URL ingestion in the MVP.
- Support optional domain filtering through Tavily search.
- Use a Context Selector boundary between retrieval and report writing.
- Implement the MVP Context Selector as a Lexical Context Selector.
- The Lexical Context Selector ranks and trims sources by deterministic lexical signals, URL deduplication, domain/source limits, and context budget.
- Do not require OpenAI embeddings in the MVP.
- Do not require local embedding models in the MVP.
- Persist raw search results separately from selected context so a future embedding selector can replace the lexical selector.
- Produce a Minimal Research Result with markdown report, source URL evidence, status, error summary when relevant, and basic timestamps.
- Do not generate PDF, DOCX, or other export artifacts in the MVP.
- Do not expose full internal research context as the default user-facing result.
- Use Polling Job Observation from the Anna App Shell.
- The Anna App Shell starts a job, repeatedly calls `advance`, reads status, and then reads the result.
- The Anna App Shell must not call original GPT Researcher HTTP or WebSocket endpoints.
- The Anna App Shell should expose only query input, optional domain filter, progress/status, markdown report, and source URLs.
- Report type is fixed to `research_report`.
- No follow-up chat, model picker, report type switcher, job history, cancellation, retry orchestration, or multi-job management is included in the MVP.

## Testing Decisions

- Tests should assert external behavior and stable contracts, not private implementation details.
- The Executa Wrapper should be tested with JSON-RPC contract tests for `initialize`, `describe`, `health`, and `invoke`.
- The Research Tool Dispatcher should be tested for all Core Research Actions, including invalid action handling.
- The job store should be tested through its public create/read/update behavior, including status transitions and corrupted/missing job handling.
- The Anna Research Orchestrator should be tested as a state machine: each `advance` should move at most one bounded stage and should not skip required stages.
- The Anna Sampling integration should be tested with a fake sampling client that records requests and verifies invoke metadata is included.
- Tavily Summary Retrieval should be tested with a fake retrieval client, including empty results, domain filtering, and duplicated URLs.
- The Lexical Context Selector should be tested with deterministic fixtures for keyword overlap, URL deduplication, domain/source limits, and context budget trimming.
- Minimal Research Result serialization should be tested to ensure incomplete jobs return not-ready behavior and completed jobs return report markdown plus source URLs.
- The Anna App Shell should be tested at the app contract level: starting a job, polling/advancing, showing status, showing completed report, and surfacing errors.
- Prior art exists in Anna Executa examples: plugin contract tests, bundle app tests, and JSONL happy-path fixtures.
- Avoid tests that depend on live Tavily, live Anna Sampling, real network access, or real LLM output.
- Add a small number of live/manual smoke paths separately if needed, but do not make them required for normal CI.

## Out of Scope

- Full GPT Researcher frontend parity.
- Original FastAPI backend migration.
- Original WebSocket progress stream.
- Direct invocation of the full GPT Researcher runtime.
- Detailed reports, deep research, resource reports, outline reports, and multi-agent reports.
- Local documents, hybrid documents, Azure sources, Anna file ingestion, and arbitrary source URL ingestion.
- Browser scraping, full-page extraction, image scraping, and image generation.
- OpenAI embeddings, local embeddings, and any embedding-based context compression in the MVP.
- DuckDuckGo or anonymous search fallback.
- Retriever selection UI.
- PDF, DOCX, and markdown file export bundles.
- Follow-up chat over generated reports.
- Job history UI, cancellation, retry orchestration, and parallel job execution.
- Full LangChain-compatible Anna LLM provider.
- Model selection UI or explicit model routing inside the app.

## Further Notes

- The major risk is the interaction between long-running research work and Anna Sampling per-invoke limits. The Invoke-Advanced Research Job model addresses this by moving LLM work into short invocations.
- The second major risk is quality loss from avoiding embeddings and page scraping. The MVP accepts this trade-off to keep the first stage deployable with only Tavily and Anna Sampling.
- The Context Selector boundary is the main future-proofing point. A later Local Embedding Context Selector should be able to replace Lexical Context Selector without changing Anna App Shell or Core Research Actions.
- The retrieval boundary is the second future-proofing point. A later full-page extraction stage can be added after Tavily Summary Retrieval without changing the top-level app contract.
- If result payloads become large, file transport should be added at the response serialization boundary rather than leaking into orchestrator logic.
