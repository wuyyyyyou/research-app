Status: ready-for-agent
Labels: ready-for-agent

# Typed App Shell Messages And Locale Preference

## Parent

Engineered Anna App Shell and Bilingual UI PRD

## What to build

Add the Bilingual App Shell UI foundation to the Engineered Anna App Shell. The user should see the static app shell copy in Chinese or English based on browser language on first load, and should be able to switch between `中文` and `English` with the preference remembered locally.

This slice covers local typed dictionaries, locale detection, local persistence, and localized static UI copy. It must remain frontend-only and must not change the Research Result language strategy or the tool contract.

## Acceptance criteria

- [ ] The app shell has local typed message dictionaries for `zh-CN` and `en`.
- [ ] Chinese and English dictionaries expose the same stable message keys.
- [ ] Message lookup supports simple interpolation for dynamic UI text.
- [ ] On first load, a browser language beginning with `zh` selects Chinese.
- [ ] On first load, a non-Chinese browser language selects English.
- [ ] A stored local preference overrides browser language detection.
- [ ] The user can switch between `中文` and `English` from the app shell.
- [ ] The selected UI language is persisted in browser `localStorage`.
- [ ] The app does not request Anna storage or prefs permissions for locale persistence.
- [ ] Static UI copy is localized for titles, labels, placeholders, form controls, buttons, empty states, and source-list headings.
- [ ] Changing UI language does not add locale data to tool invocation payloads.
- [ ] Changing UI language does not change Anna Research Orchestrator prompts or report language behavior.
- [ ] Frontend tests cover locale detection, preference persistence, switching, message key parity, and interpolation.

## Blocked by

- 01-engineered-app-shell-equivalent-migration
