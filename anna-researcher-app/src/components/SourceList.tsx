import type { MessageKey } from "../i18n/messages";

interface Props {
  urls: string[];
  t(key: MessageKey): string;
}

export function SourceList({ urls, t }: Props) {
  return (
    <aside>
      <h2>{t("sourcesHeading")}</h2>
      <ul id="sources-list">
        {urls.map((url) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer noopener">
              {url}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
