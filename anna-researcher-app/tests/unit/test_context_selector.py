from researcher_adapter.context_selector import LexicalContextSelector


def test_lexical_context_selector_dedupes_limits_and_selects_context():
    selector = LexicalContextSelector(max_sources=2, max_per_domain=1, context_budget=700)
    results = [
        {
            "query": "anna app research",
            "url": "https://example.com/a",
            "title": "Anna app research architecture",
            "content": "Anna app research architecture sampling tool context result.",
        },
        {
            "query": "anna app research",
            "url": "https://example.com/a",
            "title": "duplicate",
            "content": "duplicate",
        },
        {
            "query": "anna app research",
            "url": "https://example.com/b",
            "title": "same domain",
            "content": "anna app research same domain should be limited",
        },
        {
            "query": "anna app research",
            "url": "https://docs.example.org/c",
            "title": "Research report",
            "content": "research report sampling context selector evidence",
        },
    ]

    selected = selector.select(
        query="anna app research",
        search_queries=["anna app research"],
        search_results=results,
    )

    assert selected["source_urls"] == [
        "https://example.com/a",
        "https://docs.example.org/c",
    ]
    assert "Anna app research architecture" in selected["selected_context"]
    assert len(selected["selected_sources"]) == 2


def test_lexical_context_selector_empty_input_is_stable():
    selected = LexicalContextSelector().select(
        query="missing",
        search_queries=[],
        search_results=[],
    )
    assert selected == {"selected_sources": [], "source_urls": [], "selected_context": ""}

