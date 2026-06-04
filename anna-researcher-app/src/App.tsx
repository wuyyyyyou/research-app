import { useEffect, useMemo, useState } from "react";
import { connectAnnaRuntime } from "./api/annaRuntime";
import { AnnaResearchApi, createStandaloneApi, type ResearchApi } from "./api/researchApi";
import { LanguageToggle } from "./components/LanguageToggle";
import { ReportView } from "./components/ReportView";
import { ResearchForm } from "./components/ResearchForm";
import {
  ResearchSourceDetailPage,
  ResearchSourceListPage,
  ResearchSourceNewPage,
} from "./components/ResearchSourcePanel";
import { ResearchTimeline } from "./components/ResearchTimeline";
import { StatusPanel } from "./components/StatusPanel";
import { MAX_RESEARCH_ITERATIONS, useResearchJob } from "./hooks/useResearchJob";
import { useLocale } from "./i18n/useLocale";
import { localizedError, localizedJobMessage } from "./i18n/status";

export function App() {
  const { locale, setLocale, t } = useLocale();
  const [api, setApi] = useState<ResearchApi>(() => createStandaloneApi());
  const [runtimeError, setRuntimeError] = useState<unknown>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [appPage, setAppPage] = useState<"intro" | "result" | "sources" | "source-detail" | "source-new">("intro");
  const [sourceReturnPage, setSourceReturnPage] = useState<"intro" | "result">("intro");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [briefNameDraft, setBriefNameDraft] = useState("");
  const [researchNeedDraft, setResearchNeedDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const anna = await connectAnnaRuntime();
        if (!cancelled) {
          setRuntimeError(null);
          setApi(new AnnaResearchApi(anna));
        }
      } catch (err) {
        console.warn("[anna-researcher] standalone mode:", err instanceof Error ? err.message : err);
        if (!cancelled) {
          setRuntimeError(err);
          setApi(createStandaloneApi());
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, []);

  const research = useResearchJob(api);
  const jobMessage = localizedJobMessage(research.job, t);
  const asyncErrorMessage = research.error ? localizedError(research.error, t) : "";
  const runtimeErrorMessage = runtimeError ? t("runtimeMissing") : "";
  const message = validationMessage || runtimeErrorMessage || asyncErrorMessage || jobMessage.message;
  const isMessageError = Boolean(validationMessage || runtimeErrorMessage || asyncErrorMessage || jobMessage.isError);

  const sourceResult = useMemo(() => research.result, [research.result]);
  const selectedSource = useMemo(
    () => research.sources.find((source) => source.id === selectedSourceId) ?? null,
    [research.sources, selectedSourceId],
  );
  const ready = research.canStart;
  const stepLabel = makeIntroStepLabel(research.job?.max_iterations);
  const hasCompletedResult = hasCompletedResearchResult(research.job, sourceResult);
  const showIntroPage = appPage === "intro" && !research.isBusy;

  function start(input: { briefName: string; researchNeed: string }) {
    setValidationMessage("");
    setAppPage("result");
    void research.start(formatResearchQuery(input, locale));
  }

  function showLastResult() {
    if (hasCompletedResult) {
      setValidationMessage("");
      setAppPage("result");
    }
  }

  function showNewResearch() {
    setValidationMessage("");
    setAppPage("intro");
  }

  function showSources() {
    setValidationMessage("");
    setSourceReturnPage(appPage === "result" ? "result" : "intro");
    setAppPage("sources");
  }

  function returnFromSources() {
    setValidationMessage("");
    setSelectedSourceId("");
    setAppPage(sourceReturnPage);
  }

  function showSourceDetail(id: string) {
    setValidationMessage("");
    setSelectedSourceId(id);
    setAppPage("source-detail");
  }

  function showNewSource() {
    setValidationMessage("");
    setSelectedSourceId("");
    setAppPage("source-new");
  }

  function backToSourceList() {
    setValidationMessage("");
    setAppPage("sources");
  }

  async function saveCredential(input: { id: string; credential?: string; clear?: boolean }) {
    setValidationMessage("");
    await research.updateSourceCredential(input);
  }

  async function toggleSourceEnabled(input: { id: string; enabled: boolean }) {
    setValidationMessage("");
    await research.setSourceEnabled(input);
  }

  async function addSource(input: { definition: Record<string, unknown>; credential?: string }) {
    setValidationMessage("");
    await research.upsertSource(input);
  }

  async function saveSourceDefinition(input: { definition: Record<string, unknown> }) {
    setValidationMessage("");
    return research.upsertSource(input);
  }

  async function deleteSource(input: { id: string }) {
    setValidationMessage("");
    await research.deleteSource(input);
  }

  async function testSource(input: { id: string; definition: Record<string, unknown>; query: string }) {
    setValidationMessage("");
    return research.testSource(input);
  }

  return (
    <main className="workbench" lang={locale}>
      <section className="app-window">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("appTitle")}</p>
            <h1>{t("appSubtitle")}</h1>
          </div>
          <div className="topbar-actions">
            <LanguageToggle locale={locale} setLocale={setLocale} t={t} />
            <button type="button" className="secondary source-button" onClick={showSources} data-testid="open-source-panel">
              {t("sourcesButton")}
            </button>
          </div>
        </header>

        <div className="app-window-body">
          {appPage === "sources" ? (
            <ResearchSourceListPage
              sources={research.sources}
              isBusy={research.isBusy}
              errorMessage={runtimeErrorMessage || asyncErrorMessage}
              t={t}
              onBack={returnFromSources}
              onAdd={showNewSource}
              onOpenSource={showSourceDetail}
            />
          ) : appPage === "source-detail" ? (
            <ResearchSourceDetailPage
              source={selectedSource}
              isBusy={research.isBusy}
              t={t}
              onBack={backToSourceList}
              onSaveCredential={saveCredential}
              onToggleEnabled={toggleSourceEnabled}
              onSaveDefinition={saveSourceDefinition}
              onDeleteSource={deleteSource}
              onTestSource={testSource}
            />
          ) : appPage === "source-new" ? (
            <ResearchSourceNewPage
              isBusy={research.isBusy}
              t={t}
              onBack={backToSourceList}
              onAddSource={addSource}
            />
          ) : showIntroPage ? (
            <ResearchForm
              isBusy={research.isBusy}
              canStart={ready}
              briefName={briefNameDraft}
              researchNeed={researchNeedDraft}
              t={t}
              stepLabel={stepLabel}
              validationMessage={validationMessage}
              canShowLastResult={hasCompletedResult}
              onBriefNameChange={setBriefNameDraft}
              onResearchNeedChange={setResearchNeedDraft}
              onShowLastResult={showLastResult}
              onStart={start}
              onValidationError={setValidationMessage}
            />
          ) : (
            <section className="page active research-page">
              <div className="result-toolbar">
                <button type="button" className="secondary small-button" onClick={showNewResearch}>
                  {t("newResearchButton")}
                </button>
              </div>
              <StatusPanel job={research.job} message={message} isError={isMessageError} t={t} />
              <ResearchTimeline iterations={research.job?.iterations} t={t} />
              <ReportView result={sourceResult} t={t} />
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export function formatResearchQuery(input: { briefName: string; researchNeed: string }, locale: string): string {
  const briefName = input.briefName.trim();
  const researchNeed = input.researchNeed.trim();
  if (locale === "zh-CN") {
    return [
      briefName ? `研究主题：${briefName}` : "研究主题：未提供",
      "",
      "研究具体内容：",
      researchNeed,
    ].join("\n");
  }
  return [
    briefName ? `Research topic: ${briefName}` : "Research topic: Not provided",
    "",
    "Research need:",
    researchNeed,
  ].join("\n");
}

export function makeStepLabel(input: { phase: string; iteration?: number; maxIterations?: number }): string {
  const max = Math.max(1, input.maxIterations || MAX_RESEARCH_ITERATIONS);
  const current = input.phase === "completed"
    ? max
    : Math.max(1, Math.min(max, Number(input.iteration || 1)));
  return `Step ${current}/${max}`;
}

export function makeIntroStepLabel(maxIterations?: number): string {
  return `Step 1/${Math.max(1, maxIterations || MAX_RESEARCH_ITERATIONS)}`;
}

export function hasCompletedResearchResult(
  job: { status?: string; result?: unknown } | null | undefined,
  result: unknown,
): boolean {
  return job?.status === "completed" && Boolean(result || job.result);
}
