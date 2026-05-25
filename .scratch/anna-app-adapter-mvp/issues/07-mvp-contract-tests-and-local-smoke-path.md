Status: ready-for-agent
Labels: ready-for-agent

# MVP Contract Tests And Local Smoke Path

## Parent

Anna App Adapter MVP PRD

## What to build

Complete the MVP verification layer for the Anna App Adapter. The developer should be able to run fast local tests with fake Tavily and fake Anna Sampling, then run a local smoke path that demonstrates the complete Single-Page Research Workbench lifecycle.

This slice should validate the integrated contract rather than private implementation details.

## Acceptance criteria

- [ ] JSON-RPC contract tests cover `initialize`, `describe`, `health`, and `invoke`.
- [ ] Dispatcher tests cover `start`, `advance`, `get_status`, `get_result`, invalid actions, not-ready, and completed results.
- [ ] Anna Research Orchestrator tests verify required stage order and one bounded stage per `advance`.
- [ ] Job store tests verify create, read, update, missing job, active job, and malformed record behavior.
- [ ] Fake sampling tests verify metadata and stage-specific sampling requests.
- [ ] Fake retrieval tests verify search normalization and domain filtering.
- [ ] Lexical Context Selector fixture tests verify deterministic selection.
- [ ] Anna App Shell tests verify start, polling/advance, status display, report rendering, source rendering, and error rendering.
- [ ] A local smoke path demonstrates the full lifecycle with fake Tavily and fake Anna Sampling.
- [ ] Test documentation explains which tests are offline and which optional checks require live Anna/Tavily configuration.

## Blocked by

- 01-mock-anna-research-lifecycle-tracer-bullet
- 02-anna-sampling-role-and-query-planning
- 03-tavily-summary-retrieval-with-domain-filter
- 04-lexical-context-selector
- 05-anna-sampling-report-writer-and-minimal-research-result
- 06-failure-states-and-user-facing-errors

