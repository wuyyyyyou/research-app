Status: completed
Labels: ready-for-agent

# Bundle And Regression Closure

## Parent

.scratch/local-result-transfer-server/PRD.md

## What to build

Close the Local Result Transfer Server change with bundle, contract, and regression coverage.

The built Anna App Shell bundle should reflect the transfer-save flow, and tests should catch future regressions where large completed results or full internal job data return to the Researcher Tool Protocol. Verification should stay offline and should not require live Tavily, Anna runtime, Anna LLM, or `anna-app dev`.

## Acceptance criteria

- [x] Bundle contract tests prove the built bundle no longer calls `app_save_research_result` with full report payload arguments.
- [x] Bundle contract tests prove the built bundle does not send `selected_sources` during final result save.
- [x] Backend regression tests prove compact job retrieval excludes full internal context and source bodies.
- [x] Frontend regression tests prove the transfer-save flow is used by the app orchestration.
- [x] The committed static bundle is rebuilt from frontend source.
- [x] Offline Python tests pass.
- [x] Frontend tests pass.
- [x] Frontend build passes.
- [x] Python syntax checks pass for the researcher tool and tests.
- [x] No automated verification requires starting `anna-app dev`.

## Blocked by

- .scratch/local-result-transfer-server/issues/01-backend-transfer-descriptor-and-compact-job-views.md
- .scratch/local-result-transfer-server/issues/02-local-result-transfer-server-saves-completed-results.md
- .scratch/local-result-transfer-server/issues/03-frontend-transfer-save-flow.md
