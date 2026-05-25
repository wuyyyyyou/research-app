Status: ready-for-agent
Labels: ready-for-agent

# Tavily Summary Retrieval With Domain Filter

## Parent

Anna App Adapter MVP PRD

## What to build

Add real Tavily Summary Retrieval to the Anna Research Orchestrator. The user should be able to provide an optional domain filter, advance through `search_next_query`, and see source discovery reflected in job status.

This slice should use Tavily search summaries as source text and should not scrape result pages or ingest arbitrary source URLs.

## Acceptance criteria

- [ ] The tool manifest declares Tavily Required Credential.
- [ ] The Executa Wrapper reads the Tavily credential from Anna-injected context credentials with local environment fallback.
- [ ] Missing Tavily credential is reported as a configuration error before retrieval work starts.
- [ ] The Anna App Shell supports optional domain filter input.
- [ ] `start` persists query domains when provided.
- [ ] `advance` runs `search_next_query` for planned queries using Tavily Summary Retrieval.
- [ ] Tavily results are normalized into query, URL, title when available, and summary/content fields.
- [ ] Duplicate URLs are deduplicated in stored search results.
- [ ] Source URL count is visible through `get_status`.
- [ ] No browser scraping or full-page extraction is performed.
- [ ] Tests use a fake retrieval client for success, empty results, domain filtering, duplicated URLs, and missing credential behavior.

## Blocked by

- 02-anna-sampling-role-and-query-planning

