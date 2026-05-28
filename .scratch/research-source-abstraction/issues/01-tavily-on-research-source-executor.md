Status: ready-for-agent
Labels: ready-for-agent

# 01 — Migrate Tavily To Research Source Executor (No User-Visible Change)

## Parent

[.scratch/research-source-abstraction/PRD.md](../PRD.md)

## What to build

A backbone migration that moves Tavily off the dedicated `TavilySummaryRetriever` and `app_search_web` path onto the unified Research Source abstraction, without changing what the user sees. After this slice, Tavily is a Built-in Research Source held in a Research Source Registry, executed by a Research Source Executor that understands the Configurable Research Source Envelope, and called from the Anna App Shell through the new `app_call_research_source` App Tool Method.

The Anna App Shell keeps its current linear research flow (role selection → query planning → search → context selection → report writing). The only frontend changes are that the search stage calls `app_call_research_source({ source_id: "tavily", queries: [...] })` instead of `app_search_web`, and the workbench's "限定网站" / domain filter input is removed because the new envelope no longer carries a `query_domains` placeholder.

The Researcher Tool Backend writes new job records with `schema_version: 2` and a single-entry `iterations[]` array (one entry representing the linear pipeline's combined search step). Pre-existing job records without `schema_version` are surfaced as legacy and not advanced. The legacy `tavily_api_key` settings field is migrated once at startup into the new credential slot, idempotently.

A Modal/Drawer Research Source Panel is introduced as the new credential-editing surface. In this slice it lists only the Tavily Built-in entry with structural fields read-only and the credential field editable. The current `SettingsForm` Tavily key UI is replaced by a button on the workbench that opens the Panel.

Respect ADR 0003 (unified Research Source abstraction) and ADR 0004 (constrained envelope). The Iterative Research Loop (ADR 0005) is NOT introduced in this slice — that arrives in the next issue.

### Decision-rich shape carried over from the PRD

Tavily Built-in entry, held in backend code, runs through the executor like any other Research Source:

```jsonc
{
  "id": "tavily",
  "name": "Tavily",
  "kind": "builtin",
  "max_parallel": 3,
  "request": { "method": "POST", "url": "...", "headers": { "...": "{token}" }, "body": "..." },
  "pagination": { "mode": "page", "max_pages": 1, "page_size": 5, "start_page": 1 },
  "field_map": { "items_path": "results[]", "url": "url", "title": "title", "content": ["content"] }
}
```

The exact Tavily envelope details are an implementation choice as long as the executor drives them; the only invariant is "Tavily is no longer a special HTTP path".

## Acceptance criteria

- [ ] A Research Source Registry module exposes `list`, `get`, `update_credential` (Built-in + User-Configured combined), with the Tavily Built-in entry hardcoded.
- [ ] A Research Source Executor module performs HTTP for Tavily through `{token}` / `{query}` / `{page}` / `{page_size}` / `{cursor}` placeholder substitution, dot-and-bracket-index `field_map` resolution, `field_map.content` as an array joined by `\n` with primitives stringified, and the three pagination modes capped at five pages per call.
- [ ] The Executor classifies HTTP failures into the six fixed error codes (`auth_failed | rate_limited | upstream_5xx | timeout | bad_definition | empty_result`); `empty_result` is not treated as an error.
- [ ] GET requests retry once with 1 s backoff on 429 / 5xx; POST requests do not retry.
- [ ] A Credential Store module manages secrets in `~/anna-workspace/.research`, returns front-0-back-4 masked previews on read, and never copies the full secret into job records, logs, fixtures, or frontend payloads.
- [ ] On backend startup, the legacy `tavily_api_key` settings field is migrated once into `sources["tavily"].credential`, idempotently (no resurrection after clear).
- [ ] `app_call_research_source({ research_id, iteration, source_id, queries })` performs one source call, appends `iterations[i].source_calls[]` and `iterations[i].raw_results[]` to the job record, and returns `{ job, source_call: { source_id, queries, results_count, top_titles, duration_ms, error } }` without exposing raw_results to the frontend.
- [ ] `app_list_research_sources` returns the Tavily entry shaped as `{ id, name, kind: "builtin", credential_status, credential_masked?, max_parallel, enabled, description }` (no `definition` for Built-in).
- [ ] `app_update_research_source_credential` accepts `{ id, credential }` or `{ id, clear: true }` for the Tavily id.
- [ ] `app_search_web` is removed entirely from the dispatcher; `describe` does not list it.
- [ ] Job records created in this slice carry `schema_version: 2` and one `iterations[]` entry; records without `schema_version` are surfaced as legacy and not advanced by the frontend.
- [ ] Lexical Context Selector receives flat normalized items carrying `source_id`, falls back to `(source_id, title)` for URL-empty deduplication, and prefixes each emitted context item with `[来源: <name>]`.
- [ ] Anna App Shell calls `app_call_research_source({ source_id: "tavily", queries: planned })` from the existing linear pipeline; the report generation flow remains otherwise unchanged.
- [ ] Workbench removes the "限定网站" / domain filter input and the `parseDomains` path; no `query_domains` field appears in any new request payload.
- [ ] A Modal/Drawer Research Source Panel renders the Tavily Built-in entry only, with structural fields read-only and credential editable; the previous Tavily key UI in `SettingsForm` is removed in favor of opening the Panel.
- [ ] Backend offline tests cover Research Source Registry (Built-in listing, masking, `app_delete_research_source` refusal for Built-in), Research Source Executor (all six error classifications, GET-retry vs POST-no-retry, three pagination modes, placeholder + field_map paths against fake JSON fixtures), Credential migration (idempotent, mask shape, post-clear non-resurrection), and Dispatcher + Job Store v2 (new method contracts, schema_version on creation, legacy records surfaced as non-resumable).
- [ ] Bundle contract test asserts the built static SPA contains `app_call_research_source` and does not contain `app_search_web` or `query_domains` payload references.
- [ ] An end-to-end Tavily research run (with fake Tavily fixtures) produces a report indistinguishable from today's output except for the new `[来源: Tavily]` provenance prefix on context items.

## Blocked by

None — can start immediately.
