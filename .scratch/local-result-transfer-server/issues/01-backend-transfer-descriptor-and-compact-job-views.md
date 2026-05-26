Status: completed
Labels: ready-for-agent

# Backend Transfer Descriptor And Compact Job Views

## Parent

.scratch/local-result-transfer-server/PRD.md

## What to build

Change the Researcher Tool Backend control-plane contract so large Research Results no longer travel through the Researcher Tool Protocol.

`app_save_research_result` should become a small App Tool Method that accepts a `research_id` and returns a transfer descriptor for the Local Result Transfer Server. It should not directly save `report_markdown`, echo `selected_sources`, or return a full job record through stdio.

At the same time, compact job retrieval so `app_get_research_job` can recover the latest or requested job without returning full internal research context. Completed jobs should still include enough compact result data for the Anna App Shell to display the markdown report and source URLs.

## Acceptance criteria

- [x] `app_save_research_result` accepts only the small control-plane save request needed to identify the target research job.
- [x] `app_save_research_result` returns a transfer descriptor with method, URL, and JSON content type.
- [x] `app_save_research_result` no longer saves a report directly from stdio arguments.
- [x] `app_save_research_result` no longer returns full job data, `report_markdown`, `selected_sources`, `search_results`, or `selected_context` through stdio.
- [x] Direct-save style arguments do not preserve the old direct-save behavior.
- [x] `app_get_research_job` returns compact job data for latest and explicit job lookup.
- [x] Completed job recovery still includes compact result data with `report_markdown` and `source_urls`.
- [x] Compact job data excludes `search_results`, `selected_context`, and `selected_sources`.
- [x] Backend tests cover the changed `app_save_research_result` contract and compact job retrieval contract.

## Blocked by

None - can start immediately
