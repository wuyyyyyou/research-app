Status: ready-for-agent
Labels: ready-for-agent

# 03 — User-Configured Research Source CRUD And Multi-Source Loop

## Parent

[.scratch/research-source-abstraction/PRD.md](../PRD.md)

## What to build

Open the Research Source abstraction to end users. The app user can register, edit, enable, disable, and delete User-Configured Research Source entries through the existing Research Source Panel (introduced in issue 01 for Tavily). Each entry follows the Configurable Research Source Envelope defined in ADR 0004: JSON over HTTP using GET or POST, a single `{token}` credential placed in header or query, response items reachable by a fixed dot-and-bracket-index path, `field_map.content` as an array of paths joined by `\n`, at most one of page-number / offset / cursor pagination, and at most five pages per source per research job.

Once a User-Configured Research Source is enabled, it naturally appears in the Iterative Research Loop's `enabled_sources` set (issue 02 already made the loop source-agnostic). The Research Step Decision LLM then picks among multiple sources across iterations based on each entry's `name` and `description`. The Lexical Context Selector mixes results from multiple sources with `[来源: <name>]` provenance prefixes and the URL-empty `(source_id, title)` deduplication fallback. The final report writer can attribute facts to specific sources when it sees the prefixed context items.

A Research Source Form inside the Panel edits a complete user definition. The form validates envelope constraints client-side before saving and never re-displays a saved credential in plaintext. Server-side, the Research Source Registry rejects out-of-envelope definitions at save time with a stable error: OAuth-shaped auth blocks, HMAC-style signing fields, multipart or streaming content types, non-JSON response declarations, user-supplied script fields, declared `max_pages > 5`, missing credential field, missing `field_map` paths, and unknown placeholder names.

Respect ADR 0003 (unified abstraction) and ADR 0004 (constrained envelope). Built-in entries (Tavily) remain unaffected by this slice's write paths: `app_upsert_research_source` and `app_delete_research_source` refuse Built-in ids.

### Decision-rich definition shape carried over from the PRD

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

## Acceptance criteria

- [ ] `app_upsert_research_source` accepts a complete User-Configured definition, validates it against the envelope at save time, persists it under `~/anna-workspace/.research`, and returns the saved entry view; updating an entry preserves its id.
- [ ] `app_upsert_research_source` rejects, with a stable error per case: OAuth-shaped auth, HMAC or signature fields, multipart or streaming content types, non-JSON response declarations, user-supplied script fields, `max_pages > 5`, missing credential field, missing `field_map` paths (`items_path` / `url` / `title` / at least one `content` path), and unknown placeholder names beyond `{token} {query} {page} {page_size} {cursor}`.
- [ ] `app_upsert_research_source` and `app_delete_research_source` refuse Built-in ids with a stable error.
- [ ] `app_delete_research_source` removes a User-Configured entry and its credential slot in one operation.
- [ ] `app_list_research_sources` returns Built-in and User-Configured entries together; only User-Configured entries carry a `definition` block; both kinds expose `credential_status`, `credential_masked`, `max_parallel`, and `enabled`.
- [ ] Research Source Panel adds an "Add Research Source" action that opens a Research Source Form for a new entry; per-row actions for User-Configured entries include enable/disable, edit definition, edit credential, and delete; for Built-in entries only enable/disable and edit credential are available.
- [ ] Research Source Form validates envelope constraints client-side (method ∈ {GET, POST}, exactly one pagination mode, `max_pages ≤ 5`, all five placeholders are recognized, `field_map.content` is a non-empty array of paths) and surfaces a clear inline error before submission.
- [ ] Research Source Form never re-displays a saved credential in plaintext; an existing credential shows the front-0-back-4 mask and a "replace" action; cleared credentials remove the slot value.
- [ ] The Iterative Research Loop's `enabled_sources` reflects the enable/disable toggles from the Panel; disabling Tavily and enabling only a User-Configured source produces a research run that calls that source exclusively (when the LLM agrees with that routing).
- [ ] Research Step Decision prompts list each enabled source's `name` and `description` so the LLM has the routing signal it needs.
- [ ] The Lexical Context Selector emits items from multiple sources in one combined ranking; URL-empty items dedup by `(source_id, title)` and survive selection; each emitted context item carries `[来源: <name>]` prefix.
- [ ] The final report attribution behavior remains optional: the writer prompt does not force per-paragraph source labels, but the prefixed context allows it to attribute when natural.
- [ ] Backend offline tests cover Research Source Registry envelope rejection paths (each named case above) and Built-in id refusal for upsert and delete; cover Lexical Context Selector cross-source ranking and URL-empty dedup with multi-source fixtures.
- [ ] Frontend offline tests cover the Research Source Form client-side validation cases above, including credential masking on edit, and Panel CRUD interactions against a fake `app_list_research_sources` / `app_upsert_research_source` / `app_delete_research_source` / `app_update_research_source_credential` set.
- [ ] An end-to-end demo (with fake HTTP fixtures for both Tavily and a fake 天眼查 endpoint) shows: add a 天眼查 source through the Panel, enable both, run research, the Iterative Research Loop alternates between the two sources across iterations, the Timeline displays both, and the final report context shows `[来源: Tavily]` and `[来源: 天眼查]` prefixes on different fragments.

## Blocked by

- [02 — Iterative Research Loop Replacing Linear Pipeline](./02-iterative-research-loop-tavily-only.md)
