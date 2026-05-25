from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[2]


def test_bundle_uses_core_research_actions():
    app_js = (APP_ROOT / "bundle" / "app.js").read_text(encoding="utf-8")
    assert 'callResearch("start"' in app_js
    assert 'callResearch("advance"' in app_js
    assert 'callResearch("get_result"' in app_js
    assert "query_domains" in app_js


def test_manifest_declares_single_required_tool():
    manifest = (APP_ROOT / "manifest.json").read_text(encoding="utf-8")
    assert "tool-test-researcher-12345678" in manifest
    assert "tools.invoke" in manifest

