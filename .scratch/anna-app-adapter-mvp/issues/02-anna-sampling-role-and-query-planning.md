Status: ready-for-agent
Labels: ready-for-agent

# Anna Sampling Role And Query Planning

## Parent

Anna App Adapter MVP PRD

## What to build

Add Anna Sampling LLM integration for the first two LLM-backed Anna Research Orchestrator stages. The user should see a real `select_role` stage choose an Adaptive Research Role and a real `plan_queries` stage produce Bounded Query Planning output before retrieval begins.

This slice should keep each LLM operation inside a current `advance` invocation and should preserve the fallback behavior that invalid planning output degrades to the original user query.

## Acceptance criteria

- [ ] The Executa Wrapper negotiates protocol v2 sampling capability through `initialize`.
- [ ] The tool manifest declares Anna Sampling LLM capability.
- [ ] Sampling calls include the current invoke identifier in metadata.
- [ ] `advance` can execute `select_role` with Anna Sampling LLM and persist the selected role.
- [ ] `advance` can execute `plan_queries` with Anna Sampling LLM and persist bounded search queries.
- [ ] The original user query is always retained as a search query.
- [ ] Invalid or malformed role output falls back to a default research role.
- [ ] Invalid or malformed query planning output falls back to the original query.
- [ ] Sampling errors move the job into a clear failed state or return a clear tool error.
- [ ] The Anna App Shell displays `select_role` and `plan_queries` status transitions.
- [ ] Tests use a fake sampling client to verify request shape, metadata, successful parsing, and fallback behavior.

## Blocked by

- 01-mock-anna-research-lifecycle-tracer-bullet

