import type { Locale, MessageKey } from "../i18n/messages";

interface Props {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: MessageKey): string;
}

export function LanguageToggle({ locale, setLocale, t }: Props) {
  return (
    <div className="language-toggle" aria-label="Language">
      <button type="button" className={locale === "zh-CN" ? "active" : ""} onClick={() => setLocale("zh-CN")}>
        {t("languageChinese")}
      </button>
      <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>
        {t("languageEnglish")}
      </button>
    </div>
  );
}
