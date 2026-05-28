Status: ready-for-agent
Labels: ready-for-agent

# 02 — Iterative Research Loop Replacing Linear Pipeline (Tavily-only)

## Parent

[.scratch/research-source-abstraction/PRD.md](../PRD.md)

## What to build

Replace the Anna App Shell's current linear research flow with an Iterative Research Loop owned by the frontend, per ADR 0005. The loop alternates one `anna.llm.complete` call producing a Research Step Decision with one `app_call_research_source` call, accumulates a Research Step Log, and terminates on the LLM's finish decision or a safety cap of five iterations. Tavily remains the only enabled Research Source in this slice; multi-source comes in the next issue.

A Research Timeline appears on the workbench and appends one row per completed iteration, showing the source name, the issued query (or a summary when multiple queries are issued in one iteration), and the result count. A failed source call surfaces an inline error chip carrying the classified error code.

The Researcher Tool Backend gains duplicate-call prevention: `app_call_research_source` rejects an exact `(source_id, normalized_query)` repeat within the same research job. Normalization is trim + whitespace collapse + lower-case. This complements the prompt-level duplicate prevention inside the Research Step Decision prompt.

The Research Step Decision prompt builder and parser are pure functions. They are not allowed to perform IO. The decision schema is fixed:

```jsonc
{ "type": "call_source", "source_id": "...", "queries": ["...", "..."] }
// or
{ "type": "finish", "reason": "..." }
```

A malformed LLM response (invalid JSON, missing `type`, unknown `type`, missing `source_id`, empty `queries[]`) collapses to a synthesized `finish` decision with a clear reason; the loop terminates predictably rather than throwing.

Once the loop terminates, the existing `app_select_context` runs over the accumulated raw results across all iteration entries and produces the final `selected_context`. The report writer runs unchanged except for an added one-line note that context items carry `[来源: ...]` prefixes and that source attribution is optional.

Respect ADR 0005 (frontend-owned loop, not Anna Agent). Do not introduce `anna.agent.session` for this work.

## Acceptance criteria

- [ ] Anna App Shell's research orchestration is replaced by an Iterative Research Loop Orchestrator deep module with the loop state shape `{ user_query, role, enabled_sources, research_log, iteration, max_iterations: 5 }` (and persisted incrementally via `app_update_research_job`).
- [ ] The orchestrator drives exactly one `anna.llm.complete` Research Step Decision per iteration and exactly one `app_call_research_source` call per iteration when the decision is `call_source`.
- [ ] The orchestrator collapses an invalid or unparseable decision into a synthesized `finish` decision; the loop terminates predictably.
- [ ] The orchestrator enforces the safety cap by terminating at iteration five even if the LLM keeps emitting `call_source` decisions.
- [ ] A single source call returning a classified error (`auth_failed | rate_limited | upstream_5xx | timeout | bad_definition`) is recorded into the Research Step Log; the next iteration's decision is still requested and the loop continues until finish or cap.
- [ ] `empty_result` flows through the normal path; it appears in the Research Step Log as `results_count: 0` with `error: null`.
- [ ] The Research Step Decision prompt builder and parser are pure functions importing no IO, no React state, no Anna runtime; their unit tests run without any fakes.
- [ ] The prompt embeds a compact Research Step Log (iteration, source name, query, results_count, top titles) and instructs the LLM to avoid `(source_id, query)` repeats from the log.
- [ ] `app_call_research_source` rejects an exact `(source_id, normalized_query)` repeat within the same research job with a stable error; normalization is trim + whitespace collapse + lower-case.
- [ ] A Research Timeline component renders one row per completed iteration showing source name, query summary, and result count; a failed iteration shows the error code as an inline chip.
- [ ] The workbench no longer shows the old linear stage labels (`select_role`, `plan_queries`, `search_next_query`, `select_context`, `write_report`); the Timeline supersedes them. Status copy uses Localized Status Mapping for the six error codes.
- [ ] Job records now contain one iteration entry per loop turn; `app_select_context` consumes raw results across all iterations and produces the final `selected_context`.
- [ ] The report writer prompt notes that context items carry `[来源: ...]` prefixes and that source attribution is optional; the report style otherwise matches today.
- [ ] Frontend offline tests cover the Iterative Loop Orchestrator's four main paths: finish-at-iteration-1, two-calls-then-finish, safety-cap-at-iteration-5, and soft-error-continue.
- [ ] Frontend offline tests cover the Decision Prompt parser: valid `call_source`, valid `finish`, JSON wrapped in prose, malformed JSON, missing `type`, unknown `type`, missing `source_id`, and empty `queries[]` all produce the expected typed decision or finish fallback.
- [ ] An end-to-end demo (with fake Tavily fixtures and fake LLM decisions) shows the Timeline ticking through iterations, the loop terminating on `finish`, and a report being produced; a separate demo shows the safety cap firing at iteration 5 with the synthesized finish reason.

## Blocked by

- [01 — Migrate Tavily To Research Source Executor](./01-tavily-on-research-source-executor.md)
