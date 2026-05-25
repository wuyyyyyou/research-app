from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[2]


def bundle_text():
    return "\n".join(path.read_text(encoding="utf-8") for path in (APP_ROOT / "bundle").glob("assets/*.js"))


def test_bundle_uses_core_research_actions():
    js = bundle_text()
    assert '"start"' in js
    assert '"advance"' in js
    assert '"get_result"' in js
    assert '"get_status"' in js
    assert "query_domains" in js
    assert "tool-test-researcher-12345678" in js


def test_bundle_loads_anna_sdk_and_generated_entry():
    index = (APP_ROOT / "bundle" / "index.html").read_text(encoding="utf-8")
    assert "/static/anna-apps/_sdk/0.1.0/index.js" in index
    assert 'type="module"' in index
    assert "./assets/" in index


def test_bundle_does_not_use_raw_report_html_injection():
    report_view_source = (APP_ROOT / "src" / "components" / "ReportView.tsx").read_text(encoding="utf-8")
    assert "dangerouslySetInnerHTML" not in report_view_source
    assert "innerHTML" not in report_view_source


def test_manifest_declares_single_required_tool():
    manifest = (APP_ROOT / "manifest.json").read_text(encoding="utf-8")
    assert "tool-test-researcher-12345678" in manifest
    assert "tools.invoke" in manifest
