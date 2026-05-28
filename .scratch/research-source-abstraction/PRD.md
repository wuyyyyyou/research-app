Status: ready-for-agent
Labels: ready-for-agent

# PRD: User-Configured Research Source Abstraction And Iterative Research Loop

## Problem Statement

The current Anna Researcher app can only retrieve evidence through Tavily web search plus an optional domain filter. A good research report often needs data from heterogeneous external APIs — 天眼查 for Chinese company registry data, Crunchbase for startup metadata, and similar vertical sources — and the app user has no way to teach the app to use those APIs.

The user wants to register their own remote APIs from the app UI, give each one the request shape, authentication, response field mapping, pagination behavior, and a natural-language description of when to use it. During report generation, the Anna App Shell should pick which sources to call and with what queries, accumulate evidence across multiple iterations, and finally assemble a single research report. Tavily should continue to work but become one source among several, not a special path.

This PRD also retires the single-shot Bounded Query Planning stage in favor of an Iterative Research Loop that lets the LLM decide what to look up next based on what has already been found, while keeping the loop bounded and observable.

## Solution

Introduce a unified Research Source abstraction. Tavily becomes a Built-in Research Source whose definition is held in backend code. The app user can register, edit, enable, disable, and delete User-Configured Research Source entries through a Research Source Panel rendered as a Modal/Drawer in the Anna App Shell. Both kinds appear in one list, both expose `credential_masked`, both flow through the same downstream pipeline.

User-Configured Research Source definitions are constrained by the Configurable Research Source Envelope: JSON over HTTP using GET or POST, one credential carried as `{token}` in either header or query, response items reachable by a fixed dot-and-bracket-index path, `field_map.content` resolved as an array of paths joined by newline, at most one of page-number, offset, or cursor pagination, and at most five pages per source per research job. OAuth, HMAC, scripts, streaming, and multipart bodies are deliberately excluded.

The Anna Research Orchestrator drives an Iterative Research Loop. Each iteration calls `anna.llm.complete` for a Research Step Decision that either picks one enabled Research Source and one-to-three queries for it, or finishes the loop. After each call, the orchestrator records a Research Step Log entry containing the source id, query, result count, and top titles, and feeds the log back into the next decision. The loop terminates on the LLM's finish decision or a safety cap of five iterations. After the loop, the existing Lexical Context Selector ranks accumulated results, the existing report writer composes the final markdown, and a Minimal Research Result is persisted.

A new App Tool Method `app_call_research_source` performs one source's worth of work per call. The old `app_search_web` is removed. Credentials live in the existing Researcher Tool Settings location, are migrated once at startup, and are returned to the frontend only in masked form.

## User Stories

1. As an Anna user, I want to add a remote API as a new Research Source from the app, so that the app can pull evidence from sources I care about.
2. As an Anna user, I want to give a new Research Source a recognizable name and a short description of when to use it, so that the LLM can decide whether to call it for a given query.
3. As an Anna user, I want to enter the HTTP URL template and choose GET or POST, so that simple JSON APIs are covered without code changes.
4. As an Anna user, I want to enter request headers, query parameters, and body templates that contain `{token}`, `{query}`, `{page}`, `{page_size}`, and `{cursor}` placeholders, so that one definition fits many endpoints.
5. As an Anna user, I want to place my API key in a header or in a query parameter using `{token}`, so that both common auth conventions are supported.
6. As an Anna user, I want a single credential field per Research Source, so that the secret is captured exactly once and shown back only as a mask.
7. As an Anna user, I want masked credentials to show the first zero characters and last four characters, so that I can recognize which key I configured without exposing it.
8. As an Anna user, I want my credential never to be echoed in full by the UI after I save it, so that screen sharing and logs do not leak it.
9. As an Anna user, I want to configure `field_map.url`, `field_map.title`, and `field_map.content` using dot-and-bracket-index paths, so that I can point at the right fields in any nested JSON response.
10. As an Anna user, I want `field_map.content` to accept an array of paths joined by newline, so that several short fields can be combined into one usable evidence string.
11. As an Anna user, I want non-string field values to be stringified safely, so that numeric ids, booleans, and dates do not break the pipeline.
12. As an Anna user, I want to declare page-number, offset, or cursor pagination for a Research Source, so that the app can advance through multiple pages.
13. As an Anna user, I want each Research Source bounded to at most five pages per research job, so that a single source cannot dominate retrieval.
14. As an Anna user, I want the app to reject a Research Source definition whose declared `max_pages` exceeds five at save time, so that misconfiguration cannot bypass the cap.
15. As an Anna user, I want to declare `max_parallel` for each Research Source, so that I can opt sources up to two or three concurrent calls per iteration when I know the upstream tolerates it.
16. As an Anna user, I want every Research Source to default to `max_parallel: 1`, so that a freshly added source cannot accidentally hammer an unknown upstream.
17. As an Anna user, I want Tavily preconfigured with `max_parallel: 3`, so that the existing search path is no slower after this refactor.
18. As an Anna user, I want to enable or disable any Research Source from the panel, so that I can keep configured-but-paused sources without deleting them.
19. As an Anna user, I want to delete only User-Configured Research Source entries, so that Tavily as Built-in Research Source cannot be removed by accident.
20. As an Anna user, I want to edit the credential of Tavily Built-in Research Source from the same panel as user entries, so that I do not have a separate settings page just for Tavily.
21. As an Anna user, I want the panel to show Tavily structural fields as read-only, so that I cannot accidentally edit envelope details on Built-in entries.
22. As an Anna user, I want a Modal or Drawer for the Research Source Panel, so that the main Single-Page Research Workbench stays focused on the research input and result.
23. As an Anna user, I want the existing "限定网站" / domain filter input removed from the workbench, so that the UI does not carry a feature unrelated to the new source abstraction.
24. As an Anna user, I want the app to ask Anna LLM at each iteration which Research Source to call next, so that the system gathers exactly the evidence it needs without me writing a plan.
25. As an Anna user, I want the LLM to call only one Research Source per iteration, so that progress remains observable and rate limits stay predictable.
26. As an Anna user, I want the LLM to be able to issue one-to-three queries to that source in a single iteration, so that multi-faceted lookups against one API stay in one step.
27. As an Anna user, I want a hard safety cap of five iterations per research job, so that a runaway loop cannot consume unbounded time or LLM credits.
28. As an Anna user, I want the LLM to receive a compact Research Step Log of past calls in each decision, so that it does not repeat the same query against the same source.
29. As an Anna user, I want the backend to also reject an exact `(source_id, normalized_query)` duplicate within one research job, so that prompt drift cannot defeat duplicate prevention.
30. As an Anna user, I want a research timeline that appends one row per iteration showing the source name, query, and result count, so that I can see what the system is doing as it runs.
31. As an Anna user, I want a single source failing in one iteration to log a typed error and let the loop continue, so that one bad upstream does not abort the whole job.
32. As an Anna user, I want failed source calls to be classified as `auth_failed`, `rate_limited`, `upstream_5xx`, `timeout`, `bad_definition`, or `empty_result`, so that the LLM can react appropriately to each kind.
33. As an Anna user, I want `empty_result` treated as a normal outcome rather than an error, so that the LLM can decide to rephrase or change source without seeing a spurious failure.
34. As an Anna user, I want GET requests retried once with one-second backoff on 429 or 5xx, so that transient upstream hiccups do not surface as hard failures.
35. As an Anna user, I want POST requests not retried, so that non-idempotent calls cannot duplicate side effects on a flaky upstream.
36. As an Anna user, I want every result in the final report context tagged with its source name in a `[来源: ...]` prefix, so that the LLM can attribute facts naturally when writing the report.
37. As an Anna user, I want the Lexical Context Selector to fall back to `(source_id, title)` for deduplication when a Research Source returns no URL, so that structured sources without detail pages still produce usable evidence.
38. As an Anna user, I want the final report to remain a single markdown document with source URLs attached, so that the existing reading experience is unchanged.
39. As an Anna App developer, I want one unified Research Source abstraction covering Tavily and user-configured APIs, so that the downstream pipeline does not branch on source kind.
40. As an Anna App developer, I want the Researcher Tool Backend to own Built-in Research Source definitions in code, so that envelope, field map, and `max_parallel` for Tavily are not user-editable.
41. As an Anna App developer, I want User-Configured Research Source definitions persisted under `~/anna-workspace/.research`, so that they survive across runs without depending on Anna platform storage.
42. As an Anna App developer, I want one Research Source Executor that handles all sources, including Tavily, so that placeholder substitution, field path resolution, pagination, retry, and error classification are implemented once.
43. As an Anna App developer, I want the existing `TavilySummaryRetriever` retired or wrapped as a Tavily Built-in definition, so that maintenance does not split across two HTTP paths.
44. As an Anna App developer, I want a Research Source Registry to be the single read/write entry for source definitions and credentials, so that the dispatcher and executor never touch the filesystem directly.
45. As an Anna App developer, I want envelope validation to reject definitions with OAuth, HMAC, non-JSON, multipart, streaming, scripts, or `max_pages > 5` at save time, so that out-of-envelope definitions cannot enter the system.
46. As an Anna App developer, I want a Credential Store that masks on read using front-zero-back-four (e.g., `***f456`), so that masking rules are not duplicated in callers.
47. As an Anna App developer, I want the legacy `tavily_api_key` settings field migrated once at startup into `sources["tavily"].credential`, so that existing local installs continue to work.
48. As an Anna App developer, I want the migration to be idempotent and to skip when the new slot already has a credential, so that a user who clears Tavily key does not get the old value resurrected.
49. As an Anna App developer, I want `app_list_research_sources` to return Built-in and User-Configured entries in one list, so that the frontend Panel renders without knowing the storage split.
50. As an Anna App developer, I want `app_list_research_sources` to return `definition` only for `kind: "user"` entries, so that Built-in envelope details remain backend-private.
51. As an Anna App developer, I want `app_upsert_research_source` to create or update only User-Configured entries, so that Built-in entries cannot be mutated through this method.
52. As an Anna App developer, I want `app_delete_research_source` to refuse to delete Built-in entries, so that Tavily cannot be removed.
53. As an Anna App developer, I want `app_update_research_source_credential` to accept credential updates for both Built-in and User-Configured entries, so that Tavily key edits use the same method as user-configured sources.
54. As an Anna App developer, I want `app_call_research_source` to perform one source call per invocation with `{ research_id, iteration, source_id, queries }`, so that the Iterative Research Loop can be driven from the frontend.
55. As an Anna App developer, I want `app_call_research_source` to return only a `source_call` summary plus a job view, not raw_results, so that large payloads stay on the backend and the protocol stays small.
56. As an Anna App developer, I want raw results appended to `iterations[iteration].raw_results` in the job record, so that the existing Lexical Context Selector can run over the full accumulated set at the end.
57. As an Anna App developer, I want `app_search_web` removed entirely rather than aliased, so that there is no second retrieval contract for callers to drift toward.
58. As an Anna App developer, I want the job record to carry `schema_version: 2` from creation, so that future schema work has a clear discriminator.
59. As an Anna App developer, I want pre-existing job records without `schema_version` to be treated as legacy v1 and surfaced as non-resumable, so that the frontend does not crash trying to render them.
60. As an Anna App developer, I want the dedup check to use a normalized query form (trim, collapse whitespace, lower-case) keyed by `(source_id, normalized_query)`, so that prompt-level duplicate prevention and backend-level prevention agree.
61. As an Anna App developer, I want the Lexical Context Selector to receive a flat list of normalized result items carrying `source_id`, so that downstream provenance prefixing is trivial.
62. As an Anna App developer, I want context budgeting and ranking behavior unchanged from today, so that the cross-source change does not silently shift report shape.
63. As an Anna App developer, I want the frontend Iterative Research Loop Orchestrator to own all loop state, so that backend remains stateless across iterations.
64. As an Anna App developer, I want one `anna.llm.complete` call per iteration to produce the Research Step Decision, so that own-loop orchestration stays simple and debuggable.
65. As an Anna App developer, I want the Decision Prompt builder and parser to be pure functions, so that they are testable without Anna runtime.
66. As an Anna App developer, I want the Research Step Decision schema fixed to `{ type: "call_source", source_id, queries }` or `{ type: "finish", reason }`, so that the LLM cannot drift into free-form tool calls.
67. As an Anna App developer, I want a malformed LLM decision response to fall back to `finish` with a synthesized reason, so that the loop terminates predictably rather than crashing.
68. As an Anna App developer, I want the loop to record one iteration entry per decision-and-call cycle, so that the persisted shape matches the timeline UI exactly.
69. As an Anna App developer, I want the Research Source Panel rendered as a Modal/Drawer triggered by a button on the main page, so that no router or new page is introduced.
70. As an Anna App developer, I want the Research Source Form to validate envelope constraints client-side before saving, so that obvious user mistakes surface immediately instead of as backend errors.
71. As an Anna App developer, I want the report writer prompt extended only to note that context items carry `[来源: ...]` prefixes and that source attribution is optional, so that report style stays close to today's output.
72. As a future developer, I want `Research Source Registry`, `Research Source Executor`, and `Credential Store` to be deep modules with stable interfaces, so that adding a fourth source kind or a new pagination flavor does not ripple through the dispatcher.
73. As a future developer, I want the Iterative Research Loop Orchestrator to be a deep frontend module, so that LLM prompts, parsing, and recovery behavior can evolve without touching UI components.
74. As a future developer, I want ADRs 0003, 0004, and 0005 referenced from the PRD, so that future reviewers can find the reasoning behind unification, the envelope, and the loop ownership without re-deriving it.

## Implementation Decisions

- Respect ADR 0003 (unified Research Source abstraction), ADR 0004 (constrained envelope), and ADR 0005 (frontend-owned Iterative Research Loop).

### New deep modules (backend)

- **Research Source Registry** — single read/write entry for both Built-in and User-Configured Research Source definitions; envelope validation; double `max_pages` cap; list returns masked credentials; Built-in entries hardcoded in module-level data, not on disk.
- **Research Source Executor** — `execute(source_id, queries, page_limit) → normalized_results | classified_error`. Handles placeholder substitution (`{token}`, `{query}`, `{page}`, `{page_size}`, `{cursor}`), dot-and-bracket-index field path resolution, the three pagination modes, `field_map.content` array join with newline separator, primitive stringification, GET-only single retry with 1 s backoff for 429/5xx, error classification into the six fixed codes, and source-declared `max_parallel` for queries within one call.
- **Credential Store** — `~/anna-workspace/.research` slot-per-source storage; masking on read (front 0, back 4); idempotent migration from legacy `tavily_api_key` to `sources["tavily"].credential` at startup.

### Modified backend modules

- **Dispatcher** — adds `app_list_research_sources`, `app_upsert_research_source`, `app_delete_research_source`, `app_update_research_source_credential`, `app_call_research_source`; removes `app_search_web` entirely.
- **Job Store** — `schema_version: 2`, `iterations[]` array, `(source_id, normalized_query)` dedup set, legacy v1 detection (records without `schema_version` are returned as legacy).
- **Lexical Context Selector** — accepts a flat list of cross-source normalized items, falls back to `(source_id, title)` for URL-empty deduplication, prefixes each emitted context item with `[来源: <name>]`.
- **`TavilySummaryRetriever`** — retired in favor of a Tavily Built-in entry held in the Research Source Registry that runs through Research Source Executor.

### New frontend modules

- **Iterative Research Loop Orchestrator** — replaces the linear pipeline in the current `useResearchJob.ts`. Owns loop state (`user_query`, `role`, `enabled_sources`, `research_log`, `raw_results`, `iteration`, `max_iterations: 5`), drives one `anna.llm.complete` call plus one `app_call_research_source` call per iteration, terminates on finish or cap, persists incrementally through `app_update_research_job`.
- **Research Step Decision Prompt module** — pure functions `buildDecisionPrompt(state) → messages` and `parseDecision(text) → Decision`, with `{ type: "call_source", source_id, queries }` or `{ type: "finish", reason }` shape and a finish fallback on parse failure.
- **Research Source Panel** — Modal/Drawer rendering one merged list of Built-in and User-Configured sources, with enable/disable toggles, credential editor for both kinds, full CRUD for user entries only, structural fields greyed for Built-in.
- **Research Source Form** — envelope editor inside the Panel; client-side validation of envelope constraints; never shows full credential after save.
- **Research Timeline component** — renders Research Step Log entries as an append-only timeline on the workbench.

### Modified frontend modules

- **Localized Status Mapping** — adds copy for the six error codes and for timeline iteration entries.
- **ResearchForm** — removes the existing 限定网站 / domain filter input.

### Key contracts

- `app_list_research_sources` returns entries shaped as `{ id, name, kind: "builtin" | "user", credential_status: "configured" | "missing", credential_masked?, max_parallel, enabled, description, definition? }`. `definition` appears only for `kind: "user"`.
- `app_upsert_research_source` accepts a complete User-Configured definition; rejects out-of-envelope shapes and `max_pages > 5` at save time; returns the saved entry view.
- `app_delete_research_source` accepts an `id`; refuses to delete Built-in entries.
- `app_update_research_source_credential` accepts `{ id, credential }` or `{ id, clear: true }`; works for Built-in and User-Configured.
- `app_call_research_source` accepts `{ research_id, iteration, source_id, queries }` and returns `{ job, source_call: { source_id, queries, results_count, top_titles, duration_ms, error: null | "auth_failed" | "rate_limited" | "upstream_5xx" | "timeout" | "bad_definition" | "empty_result" } }`. Raw results are appended to `iterations[iteration].raw_results` in the job record, not returned to the frontend.
- Iterative Research Loop state shape:

```jsonc
{
  "user_query": "...",
  "role": { "agent_name": "...", "agent_role_prompt": "..." },
  "enabled_sources": ["tavily", "user-tianyancha-abc123"],
  "research_log": [
    { "iteration": 1, "source_id": "tavily", "query": "...", "results_count": 5, "top_titles": ["...", "..."], "error": null }
  ],
  "iteration": 1,
  "max_iterations": 5
}
```

- Research Step Decision shape returned by the LLM:

```jsonc
{ "type": "call_source", "source_id": "tavily", "queries": ["q1", "q2"] }
// or
{ "type": "finish", "reason": "Sufficient evidence collected." }
```

- Job record schema (v2):

```jsonc
{
  "research_id": "...",
  "schema_version": 2,
  "user_query": "...",
  "role": { "...": "..." },
  "iterations": [
    {
      "iteration": 1,
      "decision": { "type": "call_source", "source_id": "...", "queries": ["..."] },
      "source_calls": [
        { "source_id": "...", "query": "...", "duration_ms": 800, "results_count": 5, "error": null }
      ],
      "raw_results": [{ "source_id": "...", "url": "...", "title": "...", "content": "...", "score_hint": null }]
    }
  ],
  "selected_context": "...",
  "selected_sources": [{ "...": "..." }],
  "source_urls": ["..."],
  "final_result": { "report_markdown": "...", "source_urls": ["..."] }
}
```

### Loop and orchestration

- One `anna.llm.complete` Research Step Decision per iteration; one `app_call_research_source` per iteration; safety cap at five iterations.
- Multi-source per iteration is not supported; the decision schema only allows one source id.
- The decision prompt includes a compact Research Step Log: iteration, source name, query, results_count, top titles.
- Duplicate prevention is layered: prompt-level instruction in the decision prompt plus backend-level rejection of exact `(source_id, normalized_query)` repeats within a job. Normalization is trim, whitespace collapse, lower-case.
- A malformed LLM response falls back to `finish` with a synthesized reason. The loop terminates predictably.
- A single source call failure is recorded with its error code, surfaced in the next decision's Research Step Log, and the loop continues until finish or cap.
- After the loop terminates, the existing `app_select_context` consumes accumulated raw results across iterations and produces the final `selected_context`; the report writer remains unchanged except for the source-prefix note.

### Source definition shape (User-Configured)

```jsonc
{
  "id": "user-tianyancha-abc123",
  "name": "天眼查",
  "description": "中国大陆公司工商信息、法人代表、股东结构。优先用于查询大陆注册公司。",
  "enabled": true,
  "max_parallel": 1,
  "request": {
    "method": "GET",
    "url": "https://api.example.com/search?keyword={query}&page={page}",
    "headers": { "Authorization": "Bearer {token}" },
    "body": null
  },
  "pagination": { "mode": "page", "max_pages": 3, "page_size": 10, "start_page": 1 },
  "field_map": {
    "items_path": "data.results[]",
    "url": "company_url",
    "title": "name",
    "content": ["legal_representative", "registered_capital", "business_scope"]
  }
}
```

Tavily Built-in entry has the same shape, lives in backend code, and is the only thing the executor needs to drive it.

### UI flow

- Workbench: query input, source selector list (enabled sources from the registry, with disable toggle), start button, research timeline, final report.
- Panel: triggered by a button on the workbench; lists all sources in one table; per-row actions for enable/disable, edit credential, edit definition (user only), delete (user only); "Add Research Source" opens the Research Source Form.
- Timeline: append one row per completed iteration showing `轮次 N: <source-name> 查询 "<query>" (N 条)` plus an inline error chip if the call failed.

### Migration

- One-time idempotent migration at backend startup: copy legacy `tavily_api_key` settings field into `sources["tavily"].credential` only when the new slot is empty; remove the legacy field after copying.
- Pre-existing job records without `schema_version` are treated as legacy v1 and shown as non-resumable in the UI; the orchestrator does not attempt to continue them.

## Testing Decisions

- Tests assert external behavior and stable contracts, not private implementation details.
- Backend tests use fake HTTP fixtures and fake Tavily responses; no live network calls.
- Frontend tests use fake Anna runtime APIs; no live `anna.llm.complete` or `anna.tools.invoke`.

### Backend tests

- **Research Source Registry + envelope validation** — reject definitions with OAuth-shaped auth, HMAC-shaped signing, multipart bodies, streaming responses, scripts, `max_pages > 5`, missing credential field, missing field_map paths; accept valid definitions covering all three pagination modes; masking on read is front-0-back-4; Built-in entries cannot be deleted or have their structural fields mutated; `app_delete_research_source` refuses Built-in ids.
- **Research Source Executor** — placeholder substitution covers `{token}`, `{query}`, `{page}`, `{page_size}`, `{cursor}` in URL, headers, query parameters, and body templates; dot-and-bracket-index field path resolution against nested JSON fixtures; `field_map.content` array join uses `\n` separator and stringifies numbers/booleans; three pagination modes advance correctly and stop at the per-source `max_pages` and the global cap of five; GET on 429 and 5xx retries once with 1 s backoff and classifies as `rate_limited` / `upstream_5xx` if the retry also fails; POST does not retry; 401/403 maps to `auth_failed`; 4xx other than 401/403/429 maps to `bad_definition`; connection or read timeouts map to `timeout`; empty item list maps to `empty_result` (not an error); `max_parallel` is respected when multiple queries are passed in one call.
- **Credential migration** — idempotent migration from legacy `tavily_api_key` field into `sources["tavily"].credential`; skip when new slot already has a value; legacy field is removed after copy; masking returns front-0-back-4; clearing a credential through `app_update_research_source_credential` removes the slot value and does not resurrect on next startup.
- **Dispatcher + Job Store v2** — `app_list_research_sources` returns Built-in and User-Configured entries in one list with masked credentials and no full credential anywhere; `app_upsert_research_source` rejects Built-in id mutations; `app_call_research_source` writes one `iterations[i].source_calls[]` and `iterations[i].raw_results[]` entry, returns only the source_call summary, never the raw_results; `(source_id, normalized_query)` duplicate within the same job is rejected with a stable error; job records carry `schema_version: 2` on creation; records without `schema_version` are surfaced as legacy and not advanced; `app_search_web` is gone — describing the tool's methods does not include it.

### Frontend tests

- **Iterative Research Loop Orchestrator** — four main paths:
  1. LLM returns `finish` at iteration 1 ⇒ no source call, no iteration record, loop terminates.
  2. LLM returns `call_source` for two iterations then `finish` ⇒ exactly two iteration entries persisted with correct source ids.
  3. Safety cap path: LLM keeps returning `call_source` for six iterations ⇒ loop stops at iteration 5, terminates with synthesized finish reason.
  4. Soft error path: one iteration's `app_call_research_source` returns `{ error: "rate_limited" }` ⇒ Research Step Log includes the error code, next decision is still requested, loop continues to finish.
- **Research Step Decision parser** — pure-function tests:
  - Valid `call_source` JSON is parsed into the typed decision shape.
  - Valid `finish` JSON is parsed into the typed decision shape.
  - JSON wrapped in prose is extracted and parsed.
  - Malformed JSON, missing `type`, unknown `type`, missing `source_id`, empty `queries[]` all collapse to a `finish` fallback with a synthesized reason.
- **Lexical Context Selector cross-source** — items from two sources mix correctly; URL-empty items dedup by `(source_id, title)` and survive the selection; emitted context items carry `[来源: <name>]` prefix; ranking and context budget behavior unchanged from current Tavily-only fixtures.
- **Bundle contract** — the built static SPA bundle contains `app_call_research_source` and does not contain the string `app_search_web` (or `method:"research"`).

### Prior art

- Backend offline test layout follows the existing structure under `anna-researcher-app/tests/` and `researcher-tool/tests/` referenced from prior PRDs (`researcher-tool-frontend-orchestration`, `local-result-transfer-server`).
- Frontend tests follow the existing fake Anna runtime pattern under `anna-researcher-app/tests/frontend/`.
- Bundle contract checks follow the same pattern used by the frontend-orchestration refactor to ensure the old `method: "research"` contract is gone.

## Out of Scope

- OAuth, HMAC, or other request-signing authentication for User-Configured Research Source.
- Non-JSON response bodies (XML, CSV, HTML scraping, binary).
- Multipart or streaming requests.
- User-supplied pre-request or post-response scripts.
- More than five pages per source per research job.
- Multi-source-per-iteration calls in the Iterative Research Loop.
- Iteration counts higher than five.
- Anna Agent session as the loop driver.
- Concurrency above the source-declared `max_parallel`.
- Per-source rate-limit declarations beyond a static `max_parallel`.
- Persisting full LLM transcripts of decisions (only the compact Research Step Log entries are persisted).
- Restoring `query_domains` / 限定网站 input on the workbench.
- Migrating pre-existing job records to schema v2.
- Reintroducing `app_search_web` as an alias.
- LLM-driven boost or weighting of sources in the Lexical Context Selector (Q15c was deferred).
- Anna platform credential storage for Research Source secrets (continues to use local plaintext under `~/anna-workspace/.research`).
- Encryption at rest, system keychain integration, or per-source credential rotation tooling.
- Background or scheduled research runs.
- Multi-job concurrency, cancellation, retry orchestration, follow-up chat, history listing, or exports.
- Touching `gpt-researcher` upstream backend or frontend source.

## Further Notes

- This PRD follows the confirmed glossary updates in `CONTEXT.md` for **Research Source**, **Built-in Research Source**, **User-Configured Research Source**, **Configurable Research Source Envelope**, **Research Source Panel**, **Iterative Research Loop**, **Research Step Decision**, and **Research Step Log**, and the deprecation note on **Bounded Query Planning**.
- ADR references: `docs/adr/0003-unified-research-source-abstraction.md`, `docs/adr/0004-constrained-configurable-research-source-envelope.md`, `docs/adr/0005-iterative-research-loop-frontend-owned.md`.
- The main architectural risk is splitting Tavily handling into "old retriever" plus "new executor" by accident. Implementation must keep Tavily on the new executor path or the unification value is lost.
- The main security trade-off remains local plaintext credentials under `~/anna-workspace/.research`. The Credential Store must keep credentials out of logs, job records, fixtures, and frontend bundle assets.
- The main regression risk is stale bundle or test code still referencing `app_search_web` or `query_domains`. Bundle contract tests should make that immediately visible.
- Issues for this feature live under `.scratch/research-source-abstraction/issues/`.
