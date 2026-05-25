Status: ready-for-agent
Labels: ready-for-agent

# Engineered App Shell Equivalent Migration

## Parent

Engineered Anna App Shell and Bilingual UI PRD

## What to build

Build the first Engineered Anna App Shell tracer bullet by replacing the hand-maintained static app script with a Vite, React, and TypeScript source-managed frontend that preserves the current Anna research workflow.

The user should still be able to enter a query, optionally provide domains, start an Async Research Job, advance/poll it through the Research Tool Dispatcher, observe status, and read a completed Research Result. This slice should keep the UI copy in English and focus on proving that the generated static bundle remains compatible with Anna's existing static SPA runtime contract.

## Acceptance criteria

- [ ] The app shell has source-managed Vite, React, and TypeScript frontend code.
- [ ] The app shell build produces the committed static bundle loaded by Anna.
- [ ] The Anna static SPA entry remains compatible with the current manifest and view configuration.
- [ ] The app still calls the required research tool through Anna host tool invocation.
- [ ] The frontend can start an Async Research Job with query and optional domain filters.
- [ ] The frontend can advance or poll the active job through the existing `advance` action.
- [ ] The frontend can load the completed Research Result through the existing `get_result` action.
- [ ] The UI still shows connection state, current status/stage, source count, progress, messages, report content, and source URLs.
- [ ] Tool action names and payload shapes remain compatible with the current Research Tool Dispatcher.
- [ ] Frontend source separates Anna tool API access from presentation components.
- [ ] Frontend source separates research job state and polling behavior from presentation components.
- [ ] Shared TypeScript types cover the tool action, job status, stage, error, and result shapes used by the UI.
- [ ] Normal build or test scripts do not start Anna App Runtime or Anna App dev.
- [ ] Existing Python Executa and bundle contract tests continue to pass or are updated only to reflect the generated bundle workflow.

## Blocked by

None - can start immediately
