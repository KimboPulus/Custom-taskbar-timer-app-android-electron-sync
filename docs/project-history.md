# Project history

This repository records a working product evolving through user-facing bugs,
platform limits, and several native taskbar-helper designs.

## Milestones

- **June 14-15, 2026:** desktop baseline, daily-plan tracking, compact and
  Windows taskbar modes, then rendering and window-lifecycle fixes.
- **June 16-18, 2026:** local sync API, Android companion, monorepo structure,
  and packaged mobile JavaScript.
- **Late June-July 2026:** exact timer input, custom alarms, shortcut handling,
  release automation, diagnostics, and daily-plan persistence hardening.

## Design changes

Taskbar integration was not a straight-line implementation. The history shows
C#, Go, and C++ helper iterations. Current Windows packaging builds the helper
from `desktop/native/FocusTimerTaskbarHost` and includes the resulting executable
as an Electron extra resource. Non-Windows builds omit taskbar mode.

Local sync also changed after testing stale devices: daily-plan dates are merged
independently so one old client cannot replace unrelated history.

Shortcut recording needed explicit modifier-state tracking. Browsers and Electron
can report modifier release in an order that loses `Ctrl+Alt`; current tests cover
those keydown/keyup sequences.

## Remaining limits

- Sync trusts every client that can reach port `5278`.
- Desktop and Android releases use separate toolchains and are not distributed
  through an app store.
- Windows taskbar behavior depends on Explorer and native Windows APIs, so unit
  tests cannot replace installer smoke testing on Windows.
