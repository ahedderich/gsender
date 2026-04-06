# gSender Project Context

## Project Overview
- gSender is an Electron desktop application for connecting to and controlling GRBL/grblHAL CNC machines.
- Primary users are hobby and prosumer CNC operators who need machine control, job execution, and setup/calibration tools.
- Core workflows:
- Connect to controller (serial/network), identify firmware, and monitor machine state.
- Load/preview G-code and run/pause/resume/stop jobs safely.
- Perform setup/tooling operations (probing, homing, surfacing, squaring, rotary setup, movement tuning).
- Configure machine/app preferences, shortcuts, macros, and optional remote/wireless control.

## Architecture
- Runtime model:
- Electron main process starts an internal Node server and opens a browser window against it.
- Frontend communicates with backend via REST + Socket.IO for near-real-time CNC events.
- Frontend:
- Location: `src/app`
- Stack: React, TypeScript/JS, Redux Toolkit + sagas, Vite build (plus legacy components).
- Major UI areas: workspace/carve view, visualizer, jogging, DRO, probe, rotary, config/tools/stats, remote mode.
- Backend:
- Location: `src/server`
- Stack: Node/Express, Socket.IO, SerialPort, controller abstractions for GRBL and grblHAL.
- Responsibilities: controller lifecycle, command dispatch, file/G-code handling, machine profiles/config persistence, API surface.
- Electron shell:
- Entry: `src/main.js`
- Handles window lifecycle, updater integration, logging, splash, and server boot.

## Important Paths
- `src/main.js`: Electron entrypoint and desktop runtime orchestration.
- `src/server-cli.js`: CLI/server bootstrap and runtime options.
- `src/server/index.js`: Express + service startup.
- `src/server/services/cncengine/CNCEngine.js`: socket/controller orchestration and CNC engine behavior.
- `src/server/controllers/Grbl` and `src/server/controllers/Grblhal`: firmware-specific parsing/behavior.
- `src/server/api`: REST endpoints (controllers, gcode, files, remote settings, metrics, job stats, etc.).
- `src/app/src`: React application code.
- `src/app/src/features`: feature modules (Jogging, Probe, Rotary, Surfacing, Config, Visualizer, etc.).
- `examples/gcode`: sample files for testing workflows.
- `test` and `cypress`: backend/unit and end-to-end tests.

## Dev Commands
- Package manager policy:
- Use `yarn` only. Do not use `npm` for install/run/build/test tasks in this repository.
- Install:
- `yarn install`
- Start dev:
- `yarn dev`
- Build production artifacts:
- `yarn build-prod`
- Run built app/server entry:
- `yarn start`
- Backend tests:
- `yarn test`
- Type-check frontend TS:
- `yarn check-types`
- E2E (interactive):
- `yarn cypress:open`

## Conventions And Patterns
- Maintain strict separation between:
- Machine-control logic in backend services/controllers.
- UI/state logic in frontend features/store.
- Prefer extending existing feature modules in `src/app/src/features/*` rather than introducing parallel patterns.
- Keep machine safety behavior explicit:
- Validate state before sending motion/control commands.
- Preserve alarm/idle/running state constraints.
- Keep API and socket event names consistent with existing conventions (e.g. `namespace:action`).
- Preserve backward compatibility for persisted config keys where possible (`configstore` records are user state).

## Guardrails
- Treat any change touching motion, probing, homing, tool-change, spindle/laser, coolant, or job execution paths as high risk.
- For high-risk paths, require:
- Clear behavioral reasoning.
- Validation against both GRBL and grblHAL logic where applicable.
- At least targeted regression checks (unit and/or manual scenario).
- Avoid breaking remote mode semantics (`remoteSettings`, socket auth/access control flow).
- Avoid changing persisted config schema without migration/backward-compat handling.
- Do not remove legacy flows unless explicitly approved; several areas include mixed legacy/new UI code.
- License must remain in place:
- Do not remove, replace, or silently alter existing license files or source header notices.
- If licensing is discussed, escalate to maintainers instead of editing license text.

## Quick Domain Notes
- gSender supports both local desktop operation and optional wireless/remote interaction.
- Visualizer behavior and file-processing performance are central user-facing quality areas.
- Firmware flashing support exists for specific boards/tooling; treat flashing flows as sensitive.

## Merge Validation Gate
- Default local development path is `yarn dev` (full app flow).
- Minimum checks for all non-trivial changes:
- `yarn check-types`
- `yarn test`
- Targeted manual verification of the changed flow in app (at least one happy path and one edge/failure path).
- Additional required checks when touching high-regression areas (based on recent commit history):
- Shortcuts/jogging/probing/toolchange/units: verify behavior in both GRBL and grblHAL scenarios.
- Visualizer/load/start-from-line/file stats: verify large-file load + start/stop + UI state transitions.
- Remote mode/network/connectivity: verify connect/disconnect/reconnect path and no white-screen/UI lockups.
- High-risk UI changes additionally require Cypress validation via `yarn cypress:open` with at least one relevant spec run covering the modified flow.
- Any bugfix should include a regression check note in PR description stating what was validated and how.
