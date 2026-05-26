Status: ready-for-agent
Labels: ready-for-agent

# PRD: Local Result Transfer Server For Large Research Results

## Problem Statement

The Anna Researcher app currently sends the completed Research Result through `anna.tools.invoke` when it calls `app_save_research_result`. That call travels through the Researcher Tool Protocol, which is JSON-RPC over stdin/stdout. Anna tool processes are known to terminate when large payloads flow through this stdio boundary.

The user hit this failure after report writing completed successfully. The job JSON was already persisted as completed, but the RPC log showed `tool_failed: executa process exited` immediately after `app_save_research_result`. The failure is caused by using the stdio tool boundary for large result payloads and large response bodies.

The user needs a temporary workaround that avoids large stdio payloads while keeping the existing Executa Local Job Store shape: one `<research_id>.json` file under `~/anna-workspace/.research/jobs`.

## Solution

Introduce a Local Result Transfer Server inside the Researcher Tool Backend.

`app_save_research_result` becomes a small control-plane App Tool Method. It accepts only the `research_id`, lazily starts or reuses a singleton local HTTP server, and returns a transfer descriptor containing a local `POST` URL. The Anna App Shell then sends the completed report markdown and source URLs to that local HTTP endpoint with `fetch`, bypassing the Executa stdio boundary for the large payload.

The local HTTP endpoint saves the Research Result through the existing job store. It continues writing the current `<research_id>.json` record and returns only the compact `job` status and `result` needed by the frontend to render the report. It does not become a public backend API, a general job update API, or a replacement for the Researcher Tool Protocol.

The existing persisted JSON format remains in place for this workaround.

## User Stories

1. As an Anna Researcher user, I want large completed reports to save without crashing the tool process, so that successful research runs do not fail at the final persistence step.
2. As an Anna Researcher user, I want the report to appear in the app after saving, so that I can read the completed research result immediately.
3. As an Anna Researcher user, I want source URLs to appear with the report, so that I can inspect the evidence used by the report.
4. As an Anna Researcher user, I want refresh recovery to avoid replaying huge internal job data through the tool protocol, so that reopening the app does not reproduce the same large-payload failure.
5. As an Anna Researcher user, I want the existing local job record to remain available, so that current completed research data is still recoverable from `~/anna-workspace/.research`.
6. As an Anna Researcher user, I want this workaround to be invisible during normal use, so that I still experience a single research flow rather than a separate export or upload step.
7. As an Anna App developer, I want `app_save_research_result` to send only a small stdio payload, so that it does not trigger the known Anna tool stdin/stdout large-payload failure.
8. As an Anna App developer, I want `app_save_research_result` to return a local transfer descriptor, so that the frontend has a deterministic place to send the large result.
9. As an Anna App developer, I want the Local Result Transfer Server to start lazily, so that the tool does not open a local HTTP port unless a save is needed.
10. As an Anna App developer, I want the Local Result Transfer Server to be a singleton, so that repeated saves do not create multiple competing local servers.
11. As an Anna App developer, I want the Local Result Transfer Server to bind only to `127.0.0.1`, so that it is not exposed on external network interfaces.
12. As an Anna App developer, I want the server to use a random available port, so that it avoids hard-coded port conflicts.
13. As an Anna App developer, I want the server lifecycle to follow the tool process lifecycle, so that no separate service management is required.
14. As an Anna App developer, I want the HTTP endpoint to save only completed Research Results, so that it does not grow into a general-purpose backend API.
15. As an Anna App developer, I want the HTTP endpoint to validate that the target research job already exists, so that it cannot create arbitrary records.
16. As an Anna App developer, I want the HTTP request body to accept only fixed result-save fields, so that it cannot become an arbitrary file or job mutation surface.
17. As an Anna App developer, I want the frontend to POST only `report_markdown` and optional `source_urls`, so that selected source content is not redundantly sent back to the backend.
18. As an Anna App developer, I want `selected_sources` to remain owned by the earlier context selection step, so that large source content is not part of the final result transfer.
19. As an Anna App developer, I want the HTTP response to include `report_markdown`, so that the frontend does not need another stdio read to show the completed report.
20. As an Anna App developer, I want the HTTP response to include only compact job status and result data, so that it does not reintroduce the large response problem through another channel.
21. As an Anna App developer, I want `app_get_research_job` to return a compact job view, so that startup recovery does not return `search_results`, `selected_context`, or `selected_sources` through stdio.
22. As an Anna App developer, I want completed job recovery to still include enough result data to display the report, so that compacting the job view does not remove the user-facing result.
23. As an Anna App developer, I want permissive CORS for this temporary local transfer server, so that Anna environments whose origins are not `http://localhost:5180` can still save results.
24. As an Anna App developer, I want the server to handle browser preflight requests, so that the frontend can POST JSON reliably.
25. As an Anna App developer, I want private-network preflight headers included, so that browser local-network protections do not block official Anna environments from reaching `127.0.0.1`.
26. As an Anna App developer, I want no token requirement for this temporary workaround, so that the bridge remains simple until Anna's stdio large-payload behavior is fixed.
27. As an Anna App developer, I want this workaround documented as temporary, so that future maintainers remove it when the platform no longer needs it.
28. As a future maintainer, I want the ADR to explain why a stdio tool starts a local HTTP server, so that I do not mistake it for the intended long-term architecture.
29. As a future maintainer, I want tests that fail if large result saving still uses `anna.tools.invoke` for the full report payload, so that this bug does not regress.
30. As a future maintainer, I want tests that fail if compact job reads include full internal context again, so that refresh recovery remains safe.

## Implementation Decisions

- Respect ADR 0002: use a Temporary Local Result Transfer Server for large Research Results.
- Keep the existing `<research_id>.json` Executa Local Job Store record as the persistence format.
- Do not split reports into separate markdown files in this PRD.
- Keep `app_save_research_result` as the control-plane App Tool Method name.
- Change `app_save_research_result` semantics so it returns a transfer descriptor instead of directly saving the report through stdio.
- Do not preserve the old direct-save compatibility mode for `app_save_research_result`.
- Make the stdio request for `app_save_research_result` accept only `research_id`.
- Return a transfer descriptor with method `POST`, a local URL, and content type `application/json`.
- Start the Local Result Transfer Server lazily on the first `app_save_research_result` call.
- Reuse one Local Result Transfer Server instance for the lifetime of the Researcher Tool Backend process.
- Bind the Local Result Transfer Server to `127.0.0.1`.
- Use an OS-assigned random port.
- Run the server on a daemon thread so it does not block process exit.
- Implement the server with Python standard library HTTP primitives rather than adding dependencies.
- Use a fixed endpoint shape: `POST /research-results/<research_id>`.
- Support `OPTIONS /research-results/<research_id>` for browser preflight.
- Return `404` for unknown paths.
- Return `405` for unsupported methods.
- Return `400` for malformed JSON or missing required result fields.
- Return `404` when the requested research job does not exist.
- Accept only `report_markdown` and optional `source_urls` in the HTTP request body.
- Require non-empty `report_markdown` for completed result saving.
- Do not accept or use `selected_sources` in the HTTP request body.
- Preserve `selected_sources` already saved by `app_select_context`.
- Use existing job store save behavior to write the completed report into the current JSON job record.
- Use `source_urls` from the HTTP body when present; otherwise preserve job source URLs.
- Return compact job status from the HTTP save response.
- Return compact Research Result from the HTTP save response.
- Include `report_markdown` and `source_urls` in the HTTP save response so the frontend can render immediately.
- Do not include `search_results`, `selected_context`, `selected_sources`, or full internal job data in the HTTP save response.
- Update frontend API shape so saving first requests the transfer descriptor through `app_save_research_result`.
- Update frontend orchestration so the large result is sent through `fetch` to the transfer URL.
- Update frontend orchestration so it does not send `selected_sources` during final save.
- Update frontend state using the HTTP save response.
- Treat HTTP save failure as a research failure in the UI.
- Optionally mark the job failed through the existing small `app_update_research_job` path after HTTP save failure.
- Compact `app_get_research_job` so stdio recovery does not return full `search_results`, `selected_context`, or `selected_sources`.
- Preserve completed result display on `app_get_research_job` by returning compact result data.
- Use permissive CORS for the temporary server because official Anna origins may not be `localhost:5180`.
- Return `Access-Control-Allow-Origin: *`.
- Return `Access-Control-Allow-Methods: POST, OPTIONS`.
- Return `Access-Control-Allow-Headers: Content-Type`.
- Return `Access-Control-Allow-Private-Network: true` for browser local-network preflight compatibility.
- Do not set `Access-Control-Allow-Credentials`.
- Do not use cookies.
- Do not add token authorization for this temporary workaround.
- Keep backend stdout restricted to JSON-RPC frames; the HTTP server must not print protocol-breaking stdout logs.
- Keep this workaround framed as removable once Anna's stdio large-payload behavior is fixed.

## Testing Decisions

- Tests should assert external behavior and protocol contracts, not private implementation details.
- Add backend unit tests for `app_save_research_result` returning a transfer descriptor with no direct result payload.
- Add backend unit tests that direct-save arguments no longer save a report through stdio.
- Add backend tests for the Local Result Transfer Server POST endpoint.
- Test that HTTP POST with `report_markdown` saves the report into the existing job record.
- Test that HTTP POST with `source_urls` saves or preserves source URLs as specified.
- Test that HTTP POST does not require or persist client-provided `selected_sources`.
- Test that existing `selected_sources` from context selection survive final HTTP result save.
- Test that HTTP response includes compact `job` and `result`.
- Test that HTTP response does not include `search_results`, `selected_context`, or `selected_sources`.
- Test that malformed JSON returns a clear `400`.
- Test that missing or blank `report_markdown` returns a clear `400`.
- Test that an unknown `research_id` returns `404`.
- Test `OPTIONS` preflight returns the expected CORS and private-network headers.
- Test unsupported methods return `405`.
- Test the server binds to loopback and returns a usable URL.
- Test singleton behavior at the contract level by ensuring multiple descriptor requests reuse the same base URL during a process.
- Add frontend API tests for requesting a transfer descriptor through `anna.tools.invoke`.
- Add frontend API tests for posting the report through `fetch`.
- Add frontend orchestration tests proving final save does not send `report_markdown` or `selected_sources` through `anna.tools.invoke`.
- Add frontend orchestration tests proving final save sends `report_markdown` and optional `source_urls` through the HTTP transfer path.
- Add frontend tests proving UI result state is populated from the HTTP save response.
- Add frontend tests for HTTP save failure surfacing as a failed research state.
- Add backend tests that `app_get_research_job` returns compact job data.
- Add backend tests that completed job recovery includes compact result data but excludes full internal context and source bodies.
- Add bundle contract checks that the built static bundle uses the transfer flow and does not call `app_save_research_result` with the full report payload.
- Run existing offline Python tests after implementation.
- Run frontend tests after implementation.
- Rebuild the static bundle after frontend changes.
- Do not require live Tavily, live Anna runtime, live Anna LLM, or live `anna-app dev` for the automated test suite.

## Out of Scope

- Changing the Executa Local Job Store from `<research_id>.json` to a directory with separate `report.md`.
- Splitting report markdown into separate files.
- Designing the long-term official Anna large-payload transport.
- Fixing Anna tool stdin/stdout large-payload behavior.
- Adding token authentication to the Local Result Transfer Server.
- Restricting CORS to a fixed Anna origin.
- Turning the Local Result Transfer Server into a public API.
- Adding general job update, job read, job listing, delete, export, or file access endpoints to the Local Result Transfer Server.
- Persisting failed result state through the HTTP endpoint.
- Returning full selected sources or raw search results to the frontend after save.
- Changing Tavily settings behavior.
- Changing frontend-owned LLM orchestration.
- Changing report generation prompts or report language behavior.
- Adding PDF, DOCX, or markdown export.
- Adding history, retry, cancellation, multi-job concurrency, or follow-up chat.
- Starting `anna-app dev` as part of implementation or verification.

## Further Notes

- This PRD follows `CONTEXT.md` terminology for App Tool Methods, Researcher Tool Backend, Researcher Tool Protocol, Executa Local Job Store, Research Result, and Local Result Transfer Server.
- This PRD follows ADR 0002, which records that the local HTTP server is a temporary workaround for stdio payload limits.
- The product behavior remains a single completed markdown report with source URL evidence.
- The main regression risk is accidentally continuing to send `report_markdown`, `selected_sources`, or full job data through `anna.tools.invoke`.
- The second regression risk is fixing final save but leaving startup recovery to return full job JSON through stdio.
