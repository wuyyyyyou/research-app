import { useState } from "react";
import type { MessageKey } from "../i18n/messages";

interface Props {
  isBusy: boolean;
  canStart: boolean;
  t(key: MessageKey): string;
  onStart(query: string): void;
  onValidationError(message: string): void;
}

export function ResearchForm({ isBusy, canStart, t, onStart, onValidationError }: Props) {
  const [query, setQuery] = useState("");

  function submit() {
    const trimmed = query.trim();
    if (!trimmed) {
      onValidationError(t("enterQueryError"));
      return;
    }
    onStart(trimmed);
  }

  return (
    <section className="input-band" aria-label={t("researchInputAria")}>
      <label htmlFor="query-input">{t("queryLabel")}</label>
      <textarea
        id="query-input"
        rows={4}
        placeholder={t("queryPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="actions">
        <button type="button" onClick={submit} disabled={isBusy || !canStart}>
          {isBusy ? t("startButtonBusy") : t("startButton")}
        </button>
      </div>
    </section>
  );
}
