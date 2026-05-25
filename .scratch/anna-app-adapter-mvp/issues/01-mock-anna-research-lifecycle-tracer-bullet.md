Status: ready-for-agent
Labels: ready-for-agent

# Mock Anna Research Lifecycle Tracer Bullet

## Parent

Anna App Adapter MVP PRD

## What to build

Build the first runnable Anna App Adapter MVP tracer bullet. The user should be able to open the Single-Page Research Workbench, enter a query, start an Async Research Job, repeatedly advance it through a mock Anna Research Orchestrator, observe status changes, and read a deterministic mock markdown Research Result.

This slice should establish the Anna App Shell, Executa Wrapper, Research Tool Dispatcher, Core Research Actions, Single Active Job behavior, and Executa Local Job Store without integrating live Anna Sampling LLM or Tavily yet.

## Acceptance criteria

- [ ] The Anna App Shell has one research input and a start button.
- [ ] The Anna App Shell invokes the Executa Wrapper through the Anna tool API shape used by Anna App examples.
- [ ] The Executa Wrapper supports `initialize`, `describe`, `health`, and `invoke`.
- [ ] The Research Tool Dispatcher exposes `start`, `advance`, `get_status`, and `get_result`.
- [ ] `start` creates one Async Research Job and returns a research identifier.
- [ ] Starting while a job is active returns the active job instead of launching a second one.
- [ ] `advance` moves the mock job through bounded stages until completion.
- [ ] `get_status` returns job status, current stage, progress, and error summary when present.
- [ ] `get_result` returns not-ready behavior before completion and a Minimal Research Result after completion.
- [ ] The Executa Local Job Store persists job JSON between invocations.
- [ ] stdout is reserved for JSON-RPC frames and logs go to stderr.
- [ ] Contract tests cover JSON-RPC lifecycle methods and Core Research Actions with mock data.
- [ ] A local smoke path demonstrates SPA start, polling/advance, status display, and mock report display.

## Blocked by

None - can start immediately

