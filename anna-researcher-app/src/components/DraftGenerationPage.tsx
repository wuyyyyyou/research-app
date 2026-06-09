import type { MessageKey } from "../i18n/messages";

interface Props {
  stepLabel: string;
  title: string;
  message: string;
  t(key: MessageKey): string;
}

export function DraftGenerationPage({ stepLabel, title, message, t }: Props) {
  return (
    <section className="page active guided-step-page draft-generation-page" aria-label={title} aria-busy="true">
      <div className="draft-loading-panel">
        <div className="draft-spinner" aria-hidden="true" />
        <p className="step-pill">{stepLabel}</p>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="draft-loading-dots" aria-label={t("draftLoadingAria")}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
