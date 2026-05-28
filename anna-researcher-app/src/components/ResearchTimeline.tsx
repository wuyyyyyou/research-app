import type { MessageKey } from "../i18n/messages";
import type { IterationEntry, ResearchSourceErrorCode } from "../types";

interface Props {
  iterations?: IterationEntry[];
  t(key: MessageKey, params?: Record<string, string | number | undefined>): string;
}

const errorKeys: Record<ResearchSourceErrorCode, MessageKey> = {
  auth_failed: "sourceErrorAuthFailed",
  rate_limited: "sourceErrorRateLimited",
  upstream_5xx: "sourceErrorUpstream5xx",
  timeout: "sourceErrorTimeout",
  bad_definition: "sourceErrorBadDefinition",
  empty_result: "sourceErrorEmptyResult",
};

export function ResearchTimeline({ iterations, t }: Props) {
  const entries = Array.isArray(iterations) ? iterations : [];
  return (
    <section className="timeline-band" aria-label={t("timelineHeading")} data-testid="research-timeline">
      <h2>{t("timelineHeading")}</h2>
      {entries.length === 0 ? (
        <p className="timeline-empty">{t("timelineEmpty")}</p>
      ) : (
        <ol className="timeline-list">
          {entries.map((entry) => {
            const firstError = entry.source_calls.find((call) => call.error)?.error;
            const errorKey = firstError ? errorKeys[firstError as ResearchSourceErrorCode] : undefined;
            return (
              <li key={`${entry.iteration}-${entry.source_id}`}>
                <header>
                  <span className="timeline-label">
                    {t("timelineIterationLabel", { iteration: entry.iteration, source: entry.source_name })}
                  </span>
                  <span className="timeline-count">{t("timelineResultsCount", { count: entry.results_count })}</span>
                </header>
                <p className="timeline-queries">
                  <strong>{t("timelineQueriesLabel")}:</strong> {entry.queries.join(" · ")}
                </p>
                {errorKey ? (
                  <p className="timeline-error" data-error="true">
                    {t("timelineErrorPrefix", { message: t(errorKey) })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
