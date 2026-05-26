Status: completed
Labels: ready-for-agent

# Frontend Transfer Save Flow

## Parent

.scratch/local-result-transfer-server/PRD.md

## What to build

Update the Anna App Shell so completed Research Results are saved through the Local Result Transfer Server.

After frontend report writing completes, the app should call `app_save_research_result` only with the `research_id` to obtain a transfer descriptor. It should then `fetch` the descriptor URL with the completed `report_markdown` and source URLs. The frontend must not send `report_markdown` or `selected_sources` through `anna.tools.invoke`, and it should use the HTTP save response to update the visible result.

## Acceptance criteria

- [x] The frontend API layer can request a result transfer descriptor through `anna.tools.invoke`.
- [x] The frontend API layer can POST a completed result to the transfer URL with `fetch`.
- [x] Final save orchestration calls `app_save_research_result` with only the `research_id`.
- [x] Final save orchestration does not send `report_markdown` through `anna.tools.invoke`.
- [x] Final save orchestration does not send `selected_sources` through `anna.tools.invoke` or the HTTP save request.
- [x] The HTTP save request sends `report_markdown` and optional `source_urls`.
- [x] The UI result state is populated from the HTTP save response.
- [x] Source URL display continues to work after HTTP save.
- [x] HTTP save failure is surfaced as a failed research state.
- [x] Frontend tests cover the transfer descriptor request, HTTP POST save, omitted large stdio payload, result display update, and failure state.

## Blocked by

- .scratch/local-result-transfer-server/issues/01-backend-transfer-descriptor-and-compact-job-views.md
- .scratch/local-result-transfer-server/issues/02-local-result-transfer-server-saves-completed-results.md
