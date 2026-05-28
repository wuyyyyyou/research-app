import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportView } from "../../src/components/ReportView";
import { ResearchForm } from "../../src/components/ResearchForm";
import { ResearchSourcePanel } from "../../src/components/ResearchSourcePanel";
import { ResearchTimeline } from "../../src/components/ResearchTimeline";
import { createTranslator, localeStorageKey } from "../../src/i18n/messages";
import { useLocale } from "../../src/i18n/useLocale";
import type { ResearchSourceView } from "../../src/types";

function LocaleProbe() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => setLocale("en")}>
        en
      </button>
      <span>{t("queryLabel")}</span>
    </div>
  );
}

describe("locale preference UI behavior", () => {
  it("persists language switching in localStorage", async () => {
    window.localStorage.clear();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-CN");
    render(<LocaleProbe />);

    expect(screen.getByTestId("locale").textContent).toBe("zh-CN");
    fireEvent.click(screen.getByRole("button", { name: "en" }));
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en"));
    expect(window.localStorage.getItem(localeStorageKey)).toBe("en");
  });
});

describe("ResearchForm", () => {
  it("validates query input and forwards the trimmed query", () => {
    const t = createTranslator("en");
    const onStart = vi.fn();
    const onValidationError = vi.fn();
    render(<ResearchForm isBusy={false} canStart={true} t={t} onStart={onStart} onValidationError={onValidationError} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Research" }));
    expect(onValidationError).toHaveBeenCalledWith("Enter a research query.");

    fireEvent.change(screen.getByLabelText("Research query"), { target: { value: "  Anna App  " } });
    fireEvent.click(screen.getByRole("button", { name: "Start Research" }));
    expect(onStart).toHaveBeenCalledWith("Anna App");
  });
});

describe("ResearchSourcePanel", () => {
  function makeSource(overrides: Partial<ResearchSourceView> = {}): ResearchSourceView {
    return {
      id: "tavily",
      name: "Tavily",
      kind: "builtin",
      enabled: true,
      max_parallel: 3,
      credential_status: "configured",
      credential_masked: "***test",
      ...overrides,
    };
  }

  it("renders nothing when closed", () => {
    const t = createTranslator("en");
    const { container } = render(
      <ResearchSourcePanel
        open={false}
        sources={[makeSource()]}
        isBusy={false}
        t={t}
        onClose={vi.fn()}
        onSaveCredential={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("saves a credential and clears it via the modal controls", async () => {
    const t = createTranslator("en");
    const onSaveCredential = vi.fn().mockResolvedValue(undefined);
    render(
      <ResearchSourcePanel
        open={true}
        sources={[makeSource({ credential_status: "missing", credential_masked: "" })]}
        isBusy={false}
        t={t}
        onClose={vi.fn()}
        onSaveCredential={onSaveCredential}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add credential" }));
    fireEvent.change(screen.getByLabelText("Credential (Token)"), { target: { value: "tvly-new-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSaveCredential).toHaveBeenCalledWith({ id: "tavily", credential: "tvly-new-key" }),
    );
  });

  it("clears an existing credential", async () => {
    const t = createTranslator("en");
    const onSaveCredential = vi.fn().mockResolvedValue(undefined);
    render(
      <ResearchSourcePanel
        open={true}
        sources={[makeSource()]}
        isBusy={false}
        t={t}
        onClose={vi.fn()}
        onSaveCredential={onSaveCredential}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(onSaveCredential).toHaveBeenCalledWith({ id: "tavily", clear: true }));
  });

  it("toggles enabled state and shows the toggle as checked when enabled", async () => {
    const t = createTranslator("en");
    const onToggleEnabled = vi.fn().mockResolvedValue(undefined);
    render(
      <ResearchSourcePanel
        open={true}
        sources={[makeSource({ enabled: true })]}
        isBusy={false}
        t={t}
        onClose={vi.fn()}
        onSaveCredential={vi.fn().mockResolvedValue(undefined)}
        onToggleEnabled={onToggleEnabled}
      />,
    );

    const toggle = screen.getByRole("checkbox", { name: /Tavily Enabled/i }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    await waitFor(() => expect(onToggleEnabled).toHaveBeenCalledWith({ id: "tavily", enabled: false }));
  });

  it("submits a custom source definition through onAddSource", async () => {
    const t = createTranslator("en");
    const onAddSource = vi.fn().mockResolvedValue(undefined);
    render(
      <ResearchSourcePanel
        open={true}
        sources={[makeSource()]}
        isBusy={false}
        t={t}
        onClose={vi.fn()}
        onSaveCredential={vi.fn().mockResolvedValue(undefined)}
        onAddSource={onAddSource}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add custom source" }));
    fireEvent.change(screen.getByLabelText("Source definition (JSON)"), {
      target: {
        value:
          '{"id":"custom","name":"Custom","request":{"method":"GET","url":"https://api.example/?token={token}&q={query}"},"field_map":{"items_path":"results[]","url":"url","title":"title","content":["snippet"]}}',
      },
    });
    fireEvent.change(screen.getByLabelText("Credential (optional)"), { target: { value: "secret-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(onAddSource).toHaveBeenCalledWith({
        definition: expect.objectContaining({ id: "custom", name: "Custom" }),
        credential: "secret-token",
      }),
    );
  });

  it("rejects invalid JSON for new source", async () => {
    const t = createTranslator("en");
    const onAddSource = vi.fn().mockResolvedValue(undefined);
    render(
      <ResearchSourcePanel
        open={true}
        sources={[makeSource()]}
        isBusy={false}
        t={t}
        onClose={vi.fn()}
        onSaveCredential={vi.fn().mockResolvedValue(undefined)}
        onAddSource={onAddSource}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add custom source" }));
    fireEvent.change(screen.getByLabelText("Source definition (JSON)"), { target: { value: "not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.getByText("Could not parse JSON.")).toBeTruthy());
    expect(onAddSource).not.toHaveBeenCalled();
  });

  it("calls onDeleteSource for user-defined sources after confirmation", async () => {
    const t = createTranslator("en");
    const onDeleteSource = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(
        <ResearchSourcePanel
          open={true}
          sources={[makeSource({ id: "custom", name: "Custom", kind: "user" })]}
          isBusy={false}
          t={t}
          onClose={vi.fn()}
          onSaveCredential={vi.fn().mockResolvedValue(undefined)}
          onDeleteSource={onDeleteSource}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(onDeleteSource).toHaveBeenCalledWith({ id: "custom" }));
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("does not render a delete button for builtin sources", () => {
    const t = createTranslator("en");
    render(
      <ResearchSourcePanel
        open={true}
        sources={[makeSource()]}
        isBusy={false}
        t={t}
        onClose={vi.fn()}
        onSaveCredential={vi.fn().mockResolvedValue(undefined)}
        onDeleteSource={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});

describe("ResearchTimeline", () => {
  it("shows an empty hint when no iterations exist", () => {
    const t = createTranslator("en");
    render(<ResearchTimeline iterations={[]} t={t} />);
    expect(screen.getByText("No iterations have started yet.")).toBeTruthy();
  });

  it("renders each iteration's source, queries, results count, and surfaces errors", () => {
    const t = createTranslator("en");
    render(
      <ResearchTimeline
        iterations={[
          {
            iteration: 1,
            source_id: "tavily",
            source_name: "Tavily",
            queries: ["anna app"],
            results_count: 3,
            source_calls: [
              {
                source_id: "tavily",
                source_name: "Tavily",
                query: "anna app",
                results_count: 3,
                top_titles: ["Anna intro"],
                duration_ms: 12,
                error: null,
              },
            ],
          },
          {
            iteration: 2,
            source_id: "tavily",
            source_name: "Tavily",
            queries: ["anna deep dive"],
            results_count: 0,
            source_calls: [
              {
                source_id: "tavily",
                source_name: "Tavily",
                query: "anna deep dive",
                results_count: 0,
                top_titles: [],
                duration_ms: 0,
                error: "rate_limited",
              },
            ],
          },
        ]}
        t={t}
      />,
    );

    expect(screen.getByText("Iteration 1 · Tavily")).toBeTruthy();
    expect(screen.getByText("3 results")).toBeTruthy();
    expect(screen.getByText("Iteration 2 · Tavily")).toBeTruthy();
    expect(screen.getByText(/Too many requests/i)).toBeTruthy();
  });
});

describe("ReportView", () => {
  it("renders markdown and sources without raw html injection", () => {
    const t = createTranslator("en");
    const markdown = "# Title\n\n- item\n\n<script>window.bad = true</script>";
    render(<ReportView result={{ report_markdown: markdown, source_urls: ["https://example.com"] }} t={t} />);

    expect(screen.getByRole("heading", { name: "Title", level: 1 })).toBeTruthy();
    expect(screen.getByText("item")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: "https://example.com" }).getAttribute("rel")).toBe("noreferrer noopener");
  });
});
