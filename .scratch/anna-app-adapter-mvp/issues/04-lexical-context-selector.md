Status: ready-for-agent
Labels: ready-for-agent

# Lexical Context Selector

## Parent

Anna App Adapter MVP PRD

## What to build

Add the Context Selector boundary and implement the first Lexical Context Selector. The user should be able to advance from completed retrieval into `select_context`, producing bounded selected context and source URLs from Tavily search results without embeddings.

This slice should make future local embedding support a strategy replacement rather than a rewrite of the Anna App Shell or Research Tool Dispatcher.

## Acceptance criteria

- [ ] The Anna Research Orchestrator has a Context Selector boundary.
- [ ] The MVP Context Selector implementation is lexical and deterministic.
- [ ] The selector ranks sources using query/search-term overlap and title/content signals.
- [ ] The selector deduplicates URLs.
- [ ] The selector applies source/domain limits to avoid one source dominating selected context.
- [ ] The selector enforces a total context budget.
- [ ] The job record stores raw search results separately from selected context.
- [ ] The job record stores source URLs used as evidence.
- [ ] `get_status` reports selected source count after context selection.
- [ ] No OpenAI embedding, local embedding, or embedding provider credential is required.
- [ ] Tests cover ranking, URL deduplication, source/domain limits, context budget trimming, empty input, and deterministic output.

## Blocked by

- 03-tavily-summary-retrieval-with-domain-filter

