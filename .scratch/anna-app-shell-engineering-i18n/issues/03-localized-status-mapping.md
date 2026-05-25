Status: ready-for-agent
Labels: ready-for-agent

# Localized Status Mapping

## Parent

Engineered Anna App Shell and Bilingual UI PRD

## What to build

Localize dynamic research progress and error display in the Anna App Shell while keeping backend responses language-neutral. The user should see job statuses, Anna Research Orchestrator stages, source counts, progress messages, completion messages, and known error conditions in the currently selected UI language.

Raw backend error messages should remain available as fallback details, but stable protocol values should be the primary input for user-facing localized copy.

## Acceptance criteria

- [ ] Job statuses are mapped to localized Chinese and English display text.
- [ ] Anna Research Orchestrator stages are mapped to localized Chinese and English progress messages.
- [ ] Known backend error codes are mapped to localized Chinese and English user-facing errors.
- [ ] Unknown statuses, stages, or error codes have clear fallback behavior.
- [ ] Raw backend error messages are preserved as technical fallback details.
- [ ] Source count text is localized and handles zero, one, and multiple sources appropriately.
- [ ] Busy, polling, completed, failed, cancelled, and idle states use localized messages.
- [ ] The Research Tool Dispatcher contract remains language-neutral.
- [ ] The frontend does not send locale fields to the tool for status or error localization.
- [ ] Frontend tests cover localized status, stage, source count, known error-code, unknown-value, and raw-message fallback behavior.
- [ ] Existing research start, advance, polling, and result loading behavior remains unchanged.

## Blocked by

- 01-engineered-app-shell-equivalent-migration
- 02-typed-app-shell-messages-and-locale-preference
