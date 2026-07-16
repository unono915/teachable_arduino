# Project Instructions

## Product
This is a Korean classroom web app that connects a Teachable Machine image model to an Arduino robot arm through the Web Serial API.

## Required architecture
- Vite + TypeScript + Vanilla DOM
- No p5.js
- No backend
- No database
- No API keys
- Separate model inference, command stabilization, serial transport, storage, and UI modules
- Provide both real serial and mock transport implementations

## Safety
- Auto control must be OFF by default
- Never send a motor command on page load, model load, webcam start, or serial connection
- STOP must immediately disable auto control and clear pending commands
- Do not map probabilities directly to servo angles
- Validate all custom serial commands
- Keep servo limits in Arduino firmware

## Quality
- Do not suppress TypeScript errors
- Add unit tests for pure logic
- Run typecheck, lint, tests, and production build before committing
- Keep Korean user-facing messages clear
- Handle unsupported browser APIs without crashing

## Git
- Inspect git status before editing
- Do not overwrite unrelated user changes
- Never force push
- Never modify git credentials or config
- Commit only after all checks pass
- Push the current branch to origin after committing
- If push fails, report the actual error and do not claim success

## Commands
- `npm run dev` — local dev server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm test` — Vitest unit tests
- `npm run build` — production build (GitHub Pages base is derived from `GITHUB_REPOSITORY`)

## Module map
- `src/utils/validation.ts` — model URL normalization, custom command validation (pure)
- `src/serial/protocol.ts` — command constants, device line parsing, line buffering (pure)
- `src/model/predictionStabilizer.ts` — threshold / stability / cooldown / duplicate-prevention logic (pure)
- `src/settings/` — defaults and localStorage persistence with corruption recovery (pure)
- `src/serial/serialTransport.ts` / `mockTransport.ts` — real and mock transports behind one interface
- `src/model/teachableMachine.ts` — TM model loading and webcam-frame inference (tfjs directly; the `@teachablemachine/image` npm package is not used because its peer dependency pins tfjs 1.x)
- `src/app/controller.ts` — orchestration; owns no DOM
- `src/ui/` + `src/main.ts` — DOM wiring only
- Pure logic is covered by unit tests in `tests/`
