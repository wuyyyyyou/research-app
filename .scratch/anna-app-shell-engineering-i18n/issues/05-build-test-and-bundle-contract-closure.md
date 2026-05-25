Status: ready-for-agent
Labels: ready-for-agent

# Build Test And Bundle Contract Closure

## Parent

Engineered Anna App Shell and Bilingual UI PRD

## What to build

Close the Engineered Anna App Shell migration by making the build, tests, and committed bundle contract explicit and reliable. A developer or AFK agent should be able to install frontend dependencies, run frontend tests, build the static bundle, and run existing backend contract tests without starting Anna App dev.

This slice verifies that source-managed UI code is the normal editing surface, the committed bundle is generated output, and Anna's static SPA loading contract remains intact.

## Acceptance criteria

- [ ] The app shell has documented npm scripts for frontend build and frontend tests.
- [ ] The normal build script generates the committed static bundle.
- [ ] The normal test workflow does not start Anna App Runtime or Anna App dev.
- [ ] The manifest still points to a valid static SPA entry in the built bundle.
- [ ] Bundle contract tests verify the generated bundle contains the expected app entry and Anna SDK loading behavior.
- [ ] Tests verify the frontend still invokes the required research tool and Core Research Actions.
- [ ] Existing Python test runner still passes after frontend migration.
- [ ] Frontend tests cover locale behavior, localized status mapping, API wrapper call shapes, state/polling behavior, and report rendering safety.
- [ ] Build output is deterministic enough for the committed bundle to be reviewed.
- [ ] Repository ignore rules do not exclude the committed Anna bundle.
- [ ] Developer documentation or repository guidance states that generated bundle files should not be hand-edited in the normal workflow.
- [ ] Developer documentation or repository guidance preserves the rule that agents should not start Anna App dev themselves.

## Blocked by

- 01-engineered-app-shell-equivalent-migration
- 02-typed-app-shell-messages-and-locale-preference
- 03-localized-status-mapping
- 04-safe-report-markdown-rendering
