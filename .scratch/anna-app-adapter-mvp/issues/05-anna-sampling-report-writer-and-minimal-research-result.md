Status: ready-for-agent
Labels: ready-for-agent

# Anna Sampling Report Writer And Minimal Research Result

## Parent

Anna App Adapter MVP PRD

## What to build

Add real report writing for Research Report Only. The user should be able to advance from selected context into `write_report`, have Anna Sampling LLM generate a markdown `research_report`, and read a Minimal Research Result in the Single-Page Research Workbench.

This slice should return report markdown and source URL evidence only. It should not generate PDF, DOCX, export bundles, follow-up chat, or internal context dumps.

## Acceptance criteria

- [ ] `advance` executes `write_report` using Anna Sampling LLM.
- [ ] Report generation uses the selected Adaptive Research Role and selected context.
- [ ] Report type is fixed to `research_report`.
- [ ] Sampling metadata includes the current invoke identifier.
- [ ] Completed jobs persist report markdown and source URLs.
- [ ] `get_result` returns a Minimal Research Result for completed jobs.
- [ ] `get_result` returns not-ready behavior for incomplete jobs.
- [ ] The Anna App Shell renders markdown report content.
- [ ] The Anna App Shell renders source URLs with the completed report.
- [ ] The Anna App Shell does not expose PDF, DOCX, history, follow-up chat, or report type controls.
- [ ] Tests use fake sampling to verify report prompt inputs, result persistence, not-ready behavior, and completed result rendering.

## Blocked by

- 02-anna-sampling-role-and-query-planning
- 04-lexical-context-selector

