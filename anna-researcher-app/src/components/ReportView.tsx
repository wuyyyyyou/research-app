import ReactMarkdown from "react-markdown";
import type { MessageKey } from "../i18n/messages";
import type { ResearchResult } from "../types";
import { SourceList } from "./SourceList";

interface Props {
  result: ResearchResult | null;
  t(key: MessageKey): string;
}

export function ReportView({ result, t }: Props) {
  const markdown = result?.report_markdown || "";
  const sourceUrls = result?.source_urls || [];

  return (
    <section className="result-band" aria-label={t("resultAria")}>
      <article id="report" className={`report ${markdown ? "" : "empty"}`}>
        {markdown ? <ReactMarkdown>{markdown}</ReactMarkdown> : t("emptyReport")}
      </article>
      <SourceList urls={sourceUrls} t={t} />
    </section>
  );
}
