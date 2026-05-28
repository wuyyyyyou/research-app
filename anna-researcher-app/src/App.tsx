import { useEffect, useMemo, useState } from "react";
import { AnnaResearchApi, createStandaloneApi, type ResearchApi } from "./api/researchApi";
import { LanguageToggle } from "./components/LanguageToggle";
import { ReportView } from "./components/ReportView";
import { ResearchForm } from "./components/ResearchForm";
import { ResearchSourcePanel } from "./components/ResearchSourcePanel";
import { ResearchTimeline } from "./components/ResearchTimeline";
import { StatusPanel } from "./components/StatusPanel";
import { useResearchJob } from "./hooks/useResearchJob";
import { useLocale } from "./i18n/useLocale";
import { localizedError, localizedJobMessage } from "./i18n/status";
import type { AnnaRuntimeGlobal, ConnectionState } from "./types";

declare global {
  interface Window {
    AnnaAppRuntime?: AnnaRuntimeGlobal;
  }
}

export function App() {
  const { locale, setLocale, t } = useLocale();
  const [api, setApi] = useState<ResearchApi>(() => createStandaloneApi());
  const [connection, setConnection] = useState<ConnectionState>("standalone");
  const [validationMessage, setValidationMessage] = useState("");
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        if (!window.AnnaAppRuntime) throw new Error("AnnaAppRuntime SDK not loaded");
        const anna = await window.AnnaAppRuntime.connect();
        if (!cancelled) {
          setApi(new AnnaResearchApi(anna));
          setConnection("connected");
        }
      } catch (err) {
        console.warn("[anna-researcher] standalone mode:", err instanceof Error ? err.message : err);
        if (!cancelled) {
          setApi(createStandaloneApi());
          setConnection("standalone");
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
  const message = validationMessage || asyncErrorMessage || jobMessage.message;
  const isMessageError = Boolean(validationMessage || asyncErrorMessage || jobMessage.isError);

  const connectionLabel = connection === "connected" ? t("connected") : t("standalone");
  const sourceResult = useMemo(() => research.result, [research.result]);
  const ready = research.canStart;

  function start(query: string) {
    setValidationMessage("");
    void research.start(query);
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

  async function deleteSource(input: { id: string }) {
    setValidationMessage("");
    await research.deleteSource(input);
  }

  return (
    <main className="workbench" lang={locale}>
      <header className="topbar">
        <div>
          <h1>{t("appTitle")}</h1>
          <p>{t("appSubtitle")}</p>
        </div>
        <div className="topbar-actions">
          <LanguageToggle locale={locale} setLocale={setLocale} t={t} />
          <span id="conn-status" className="status-pill" data-connected={connection === "connected" ? "true" : "false"}>
            {connectionLabel}
          </span>
        </div>
      </header>

      <section className="settings-band" aria-label={t("settingsAria")}>
        <div className="settings-heading">
          <div>
            <h2>{t("settingsTitle")}</h2>
            <p>{ready ? t("settingsConfigured") : t("settingsMissing")}</p>
          </div>
          <button type="button" onClick={() => setSourcePanelOpen(true)} data-testid="open-source-panel">
            {t("manageSourcesButton")}
          </button>
        </div>
      </section>

      <ResearchForm
        isBusy={research.isBusy}
        canStart={ready}
        t={t}
        onStart={start}
        onValidationError={setValidationMessage}
      />

      <StatusPanel job={research.job} message={message} isError={isMessageError} t={t} />
      <ResearchTimeline iterations={research.job?.iterations} t={t} />
      <ReportView result={sourceResult} t={t} />

      <ResearchSourcePanel
        open={sourcePanelOpen}
        sources={research.sources}
        isBusy={research.isBusy}
        t={t}
        onClose={() => setSourcePanelOpen(false)}
        onSaveCredential={saveCredential}
        onToggleEnabled={toggleSourceEnabled}
        onAddSource={addSource}
        onDeleteSource={deleteSource}
      />
    </main>
  );
}
