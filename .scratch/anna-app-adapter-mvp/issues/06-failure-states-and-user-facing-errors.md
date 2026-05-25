Status: ready-for-agent
Labels: ready-for-agent

# Failure States And User-Facing Errors

## Parent

Anna App Adapter MVP PRD

## What to build

Harden the Anna App Adapter MVP error model across the app, wrapper, dispatcher, job store, sampling, and retrieval paths. The user should receive clear status and error messages instead of silent failures, corrupted protocol frames, or misleading completed reports.

This slice should standardize failed job states and user-facing messages for configuration, sampling, retrieval, invalid action, not-ready, and malformed local job data cases.

## Acceptance criteria

- [ ] Missing Tavily credential produces a clear configuration failure.
- [ ] Anna Sampling not granted, quota exceeded, provider error, and timeout failures are surfaced clearly.
- [ ] Tavily empty result and Tavily request failures are reflected in status or failed job state.
- [ ] Invalid action names return invalid-parameter style errors.
- [ ] Missing or unknown research identifiers return clear not-found behavior.
- [ ] `get_result` on incomplete jobs returns clear not-ready behavior.
- [ ] Malformed job store records fail predictably and do not produce misleading reports.
- [ ] The Anna App Shell displays error status and error summary.
- [ ] Logs stay on stderr and do not corrupt JSON-RPC stdout.
- [ ] Tests cover each failure path with fake sampling, fake retrieval, and malformed local job data.

## Blocked by

- 01-mock-anna-research-lifecycle-tracer-bullet
- 02-anna-sampling-role-and-query-planning
- 03-tavily-summary-retrieval-with-domain-filter
- 05-anna-sampling-report-writer-and-minimal-research-result

