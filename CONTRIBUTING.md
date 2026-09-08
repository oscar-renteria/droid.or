# Contributing

## Getting started

See `DEVELOPMENT.md` for setup and the full set of npm scripts. In short:

```bash
npm install
npm run dev
```

## Before opening a change

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
```

All four should pass. `npm run build` runs `typecheck` again as part of
bundling, so a type error never silently ships.

## Code style

- Strict TypeScript; avoid `any` wherever reasonably possible.
- Keep business logic and ADB access out of `.vue` files — a view reads
  from a Pinia store and calls store actions; the store is the only thing
  that talks to `window.droidor`.
- Keep IPC contracts strongly typed and validate every payload with Zod,
  in both directions (see `ARCHITECTURE.md`).
- Prefer the reliable, boring implementation over the clever one.
- Don't invent ADB/Android capabilities. If something can't be verified or
  isn't actually supported on a non-rooted device, say so rather than
  quietly assuming it works.
- Default to no comments; add one only when the _why_ isn't obvious from
  the code itself — a non-obvious constraint, a workaround for a specific
  device's behavior, something that would otherwise surprise a reader.

Formatting is enforced by Prettier (`npm run format`) and linting by ESLint
(`npm run lint`) — don't hand-format against what those tools would apply.

## Testing

- Tests live under `tests/`, mirroring the `src/` layout they exercise.
- Anything that touches `AdbClient` should use the existing `FakeAdbClient`
  (`tests/fakes/fake-adb-client.ts`) rather than mocking `child_process`
  directly.
- A renderer store test should generally mount a small real component that
  reads the store through Vue's reactivity system, not just assert on the
  store object directly — see any existing `*.store.test.ts` for the
  pattern, and `ARCHITECTURE.md` for why this matters.
- Before writing a parser for new `adb shell`/`dumpsys`/`settings` output,
  run the actual command against a real connected device first if you can.
  Documented behavior has genuinely differed from real device output more
  than once in this project (see `ANDROID_COMPATIBILITY.md`) — verifying
  against real hardware, not just assuming a documented format, is an
  established practice here, not an optional nicety.

## Commit messages

Focus on _why_ a change was made, not a restatement of the diff. Recent
history in this repository is a reasonable guide to the expected tone and
level of detail.

## Scope

This project follows the specification in `docs/specification.md` and
proceeds milestone by milestone. If you're proposing a new feature, check
whether it's already covered there (as done, planned, or explicitly ruled
out) before assuming it's out of scope or missing — the spec is
deliberately explicit about what's technically impossible, unreliable, or
misleading on a non-rooted device, and features that would require root or
would misrepresent what actually happened on the device are rejected by
design, not by oversight.
