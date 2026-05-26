Status: completed
Labels: ready-for-agent

# Local Result Transfer Server Saves Completed Results

## Parent

.scratch/local-result-transfer-server/PRD.md

## What to build

Implement the Local Result Transfer Server inside the Researcher Tool Backend so the Anna App Shell can save completed Research Results through local HTTP instead of stdio.

The server should start lazily, run as a singleton for the tool process lifetime, bind only to `127.0.0.1`, use an OS-assigned random port, and expose only the fixed completed-result save endpoint. The endpoint should save `report_markdown` and optional `source_urls` to the existing `<research_id>.json` job record through the existing job store and return only compact `job` and `result` data.

## Acceptance criteria

- [x] The Local Result Transfer Server starts lazily on the first transfer descriptor request.
- [x] Multiple transfer descriptor requests reuse the same server base URL during one tool process.
- [x] The server binds to `127.0.0.1` and uses an OS-assigned random port.
- [x] The server supports `POST /research-results/<research_id>`.
- [x] The server supports `OPTIONS /research-results/<research_id>` for browser preflight.
- [x] CORS responses include permissive origin, allowed methods, allowed headers, and private-network access headers.
- [x] The server does not use cookies, credentials, or token authorization.
- [x] `POST` accepts `report_markdown` and optional `source_urls`.
- [x] `POST` rejects malformed JSON and blank completed reports with clear `400` responses.
- [x] `POST` returns `404` when the research job does not exist.
- [x] Unsupported methods return `405`; unknown paths return `404`.
- [x] Successful `POST` persists the completed report into the existing job JSON record.
- [x] Successful `POST` preserves existing `selected_sources` rather than accepting client-provided source bodies.
- [x] Successful `POST` returns compact `job` and `result` data including `report_markdown` and `source_urls`.
- [x] Successful `POST` response excludes `search_results`, `selected_context`, and `selected_sources`.
- [x] Backend tests cover endpoint success, validation errors, CORS/preflight behavior, loopback URL shape, and singleton behavior.

## Blocked by

- .scratch/local-result-transfer-server/issues/01-backend-transfer-descriptor-and-compact-job-views.md
