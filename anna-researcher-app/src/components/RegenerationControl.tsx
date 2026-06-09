import { useState } from "react";
import type { MessageKey } from "../i18n/messages";

interface Props {
  label: string;
  value: string;
  t(key: MessageKey): string;
  disabled?: boolean;
  onChange(value: string): void;
  onRegenerate(): void;
}

export function RegenerationControl({ label, value, t, disabled, onChange, onRegenerate }: Props) {
  const [open, setOpen] = useState(false);
  function regenerate() {
    onRegenerate();
    setOpen(false);
  }

  return (
    <div className="regen-menu">
      <button type="button" className="secondary small-button regen-trigger" onClick={() => setOpen(true)} disabled={disabled}>
        {label}
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <div className="regen-dialog" role="dialog" aria-modal="true" aria-labelledby="regen-dialog-title">
            <h3 id="regen-dialog-title">{label}</h3>
            <p>{t("regenerateDialogDescription")}</p>
            <label>
              {t("regenInstructionLabel")}
              <textarea
                value={value}
                placeholder={t("regenInstructionPlaceholder")}
                onChange={(event) => onChange(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                {t("cancelButton")}
              </button>
              <button type="button" className="primary-action" onClick={regenerate} disabled={disabled}>
                {t("regenerateButton")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
