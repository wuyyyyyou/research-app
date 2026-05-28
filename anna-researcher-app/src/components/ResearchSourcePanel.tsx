import { useEffect, useMemo, useState } from "react";
import type { MessageKey } from "../i18n/messages";
import type { ResearchSourceView } from "../types";

interface Props {
  open: boolean;
  sources: ResearchSourceView[];
  isBusy: boolean;
  t(key: MessageKey): string;
  onClose(): void;
  onSaveCredential(input: { id: string; credential?: string; clear?: boolean }): Promise<unknown>;
  onToggleEnabled?(input: { id: string; enabled: boolean }): Promise<unknown>;
  onAddSource?(input: { definition: Record<string, unknown>; credential?: string }): Promise<unknown>;
  onDeleteSource?(input: { id: string }): Promise<unknown>;
}

type Feedback = { kind: "ok" | "error"; text: string } | null;

export function ResearchSourcePanel({
  open,
  sources,
  isBusy,
  t,
  onClose,
  onSaveCredential,
  onToggleEnabled,
  onAddSource,
  onDeleteSource,
}: Props) {
  const [editing, setEditing] = useState<string>("");
  const [tokenDraft, setTokenDraft] = useState<string>("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [definitionDraft, setDefinitionDraft] = useState("");
  const [newCredentialDraft, setNewCredentialDraft] = useState("");

  useEffect(() => {
    if (!open) {
      setEditing("");
      setTokenDraft("");
      setFeedback(null);
      setAddingOpen(false);
      setDefinitionDraft("");
      setNewCredentialDraft("");
    }
  }, [open]);

  const tavily = useMemo(() => sources.find((s) => s.id === "tavily") ?? null, [sources]);

  if (!open) return null;

  async function save(id: string) {
    const value = tokenDraft.trim();
    if (!value) {
      setFeedback({ kind: "error", text: t("sourceCredentialRequired") });
      return;
    }
    try {
      await onSaveCredential({ id, credential: value });
      setEditing("");
      setTokenDraft("");
      setFeedback({ kind: "ok", text: t("sourceCredentialSaved") });
    } catch (err) {
      setFeedback(toError(err, t));
    }
  }

  async function clear(id: string) {
    try {
      await onSaveCredential({ id, clear: true });
      setEditing("");
      setTokenDraft("");
      setFeedback({ kind: "ok", text: t("sourceCredentialCleared") });
    } catch (err) {
      setFeedback(toError(err, t));
    }
  }

  async function toggleEnabled(source: ResearchSourceView) {
    if (!onToggleEnabled) return;
    try {
      await onToggleEnabled({ id: source.id, enabled: !source.enabled });
      setFeedback({ kind: "ok", text: t("sourceToggleSaved") });
    } catch (err) {
      setFeedback(toError(err, t));
    }
  }

  async function deleteSource(source: ResearchSourceView) {
    if (!onDeleteSource) return;
    if (typeof window !== "undefined" && !window.confirm(t("deleteSourceConfirm"))) return;
    try {
      await onDeleteSource({ id: source.id });
      setFeedback({ kind: "ok", text: t("sourceDeletedMessage") });
    } catch (err) {
      setFeedback(toError(err, t));
    }
  }

  async function submitNewSource() {
    if (!onAddSource) return;
    let definition: Record<string, unknown>;
    try {
      const parsed = JSON.parse(definitionDraft);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("not_object");
      }
      definition = parsed as Record<string, unknown>;
    } catch {
      setFeedback({ kind: "error", text: t("addSourceInvalidJson") });
      return;
    }
    const credential = newCredentialDraft.trim();
    try {
      await onAddSource({ definition, credential: credential || undefined });
      setAddingOpen(false);
      setDefinitionDraft("");
      setNewCredentialDraft("");
      setFeedback({ kind: "ok", text: t("sourceCredentialSaved") });
    } catch (err) {
      setFeedback(toError(err, t));
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t("sourcePanelTitle")}>
      <div className="modal-card">
        <header className="modal-header">
          <h2>{t("sourcePanelTitle")}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("closeButton")}>
            ×
          </button>
        </header>

        <section className="modal-body">
          <ul className="source-list">
            {sources.length === 0 ? <li className="source-empty">{t("sourceListEmpty")}</li> : null}
            {sources.map((source) => {
              const isEditing = editing === source.id;
              const configured = source.credential_status === "configured";
              const isBuiltin = source.kind === "builtin";
              return (
                <li key={source.id} className="source-row" data-source-id={source.id}>
                  <div className="source-row-head">
                    <div>
                      <span className="source-name">{source.name}</span>
                      <span className="source-kind">{isBuiltin ? t("sourceKindBuiltin") : t("sourceKindUser")}</span>
                    </div>
                    <span className="status-pill" data-configured={configured ? "true" : "false"}>
                      {configured ? source.credential_masked || "***" : t("sourceCredentialMissing")}
                    </span>
                  </div>
                  {source.description ? <p className="source-description">{source.description}</p> : null}
                  <div className="source-toggle-row">
                    <label className="source-toggle">
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        disabled={isBusy || !onToggleEnabled}
                        onChange={() => toggleEnabled(source)}
                        aria-label={`${source.name} ${source.enabled ? t("sourceEnabledLabel") : t("sourceDisabledLabel")}`}
                      />
                      <span>{source.enabled ? t("sourceEnabledLabel") : t("sourceDisabledLabel")}</span>
                    </label>
                  </div>
                  {isEditing ? (
                    <div className="source-editor">
                      <label htmlFor={`source-token-${source.id}`}>{t("sourceCredentialLabel")}</label>
                      <input
                        id={`source-token-${source.id}`}
                        type="password"
                        autoComplete="off"
                        placeholder={t("sourceCredentialPlaceholder")}
                        value={tokenDraft}
                        onChange={(event) => setTokenDraft(event.target.value)}
                      />
                      <div className="actions">
                        <button type="button" onClick={() => save(source.id)} disabled={isBusy || !tokenDraft.trim()}>
                          {t("saveSettingsButton")}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setEditing("");
                            setTokenDraft("");
                          }}
                        >
                          {t("cancelButton")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(source.id);
                          setTokenDraft("");
                          setFeedback(null);
                        }}
                      >
                        {configured ? t("sourceCredentialReplace") : t("sourceCredentialAdd")}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => clear(source.id)}
                        disabled={isBusy || !configured}
                      >
                        {t("clearSettingsButton")}
                      </button>
                      {!isBuiltin && onDeleteSource ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => deleteSource(source)}
                          disabled={isBusy}
                        >
                          {t("deleteSourceButton")}
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {onAddSource ? (
            <div className="add-source-block">
              {addingOpen ? (
                <div className="add-source-editor">
                  <h3>{t("addSourceTitle")}</h3>
                  <label htmlFor="add-source-definition">{t("addSourceDefinitionLabel")}</label>
                  <textarea
                    id="add-source-definition"
                    rows={8}
                    placeholder={t("addSourceDefinitionPlaceholder")}
                    value={definitionDraft}
                    onChange={(event) => setDefinitionDraft(event.target.value)}
                  />
                  <label htmlFor="add-source-credential">{t("addSourceCredentialLabel")}</label>
                  <input
                    id="add-source-credential"
                    type="password"
                    autoComplete="off"
                    value={newCredentialDraft}
                    onChange={(event) => setNewCredentialDraft(event.target.value)}
                  />
                  <div className="actions">
                    <button type="button" onClick={submitNewSource} disabled={isBusy || !definitionDraft.trim()}>
                      {t("addSourceSubmit")}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setAddingOpen(false);
                        setDefinitionDraft("");
                        setNewCredentialDraft("");
                      }}
                    >
                      {t("addSourceCancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingOpen(true)} disabled={isBusy}>
                  {t("addSourceButton")}
                </button>
              )}
            </div>
          ) : null}

          {feedback ? (
            <p className={feedback.kind === "error" ? "feedback-error" : "feedback-ok"}>{feedback.text}</p>
          ) : null}
          {!tavily ? <p className="feedback-error">{t("sourceTavilyMissing")}</p> : null}
        </section>
      </div>
    </div>
  );
}

function toError(err: unknown, t: (key: MessageKey) => string): Feedback {
  if (err instanceof Error && err.message) return { kind: "error", text: err.message };
  return { kind: "error", text: t("errorToolFailed") };
}
