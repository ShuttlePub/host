# Emumet release operations

Write-back of execution unit `emumet-release-container` (Emumet PR #111, issue #110, squash commit
`1259c731af496bb09ae11286a9b869b132a88f4d` on `main`, merged 2026-11-18). Procedures live in the child repo
(`docs/releasing.md`, `docs/container-runtime.md`); this file records only the durable decisions and the
state that the child repo cannot know.

## Decisions (user-approved in thread-xxs52dcx)

- Scope: Dockerfile, PR build + smoke, tag-driven GHCR publication, public package, **linux/amd64 only**,
  a runbook. Deploying to production is out of scope.
- Versioning: **CalVer** `vYYYY.MM.DD` (same-day serial `vYYYY.MM.DD.N`).
- CalVer date reference: **fixed JST (UTC+9)**, chosen by the user from {UTC, fixed JST, UTC + 1 day}. The day
  changes at 00:00 JST; a future date is rejected and the message shows the JST "today". The reference is the
  single constant `REFERENCE_TIMEZONE` in `scripts/validate-release.py` (changed together with its tests and
  `docs/releasing.md`).
- Runtime changes accepted with it: SIGTERM graceful shutdown (P1), file logging off by default via
  `EMUMET_FILE_LOG_ENABLED` read from the process environment only (P2), `/healthz`.
- Tag protection (ruleset, `v*`: restrict updates and deletions): agreed in principle, **not configured**.

## Not done / pending (each needs the user's explicit approval)

1. Create the tag ruleset (documented in `docs/releasing.md`, "Tag protection").
2. Optionally run the read-only `release-probe.yml` (possible only after the merge; it observes the
   authenticated GHCR answer for a package that does not exist yet).
3. Push the first `v*` tag (runs `release.yml`: validate → gate → build → publish/verify → release).
4. Change the new GHCR package from private to public, then verify an anonymous pull by tag and digest.

## Facts and unobserved behaviour

- GHCR with an **anonymous** request for the not-yet-existing package answers like a private one:
  manifest GET -> 401 `UNAUTHORIZED`, token request -> `DENIED` (observed 2026-11-17). The authenticated
  answer (expected HTTP 404 + `NAME_UNKNOWN`/`MANIFEST_UNKNOWN`) has **not been observed**; the registry state is
  treated as "absent" only on exactly that answer, so a first release can stop as "undeterminable"
  (recovery: `docs/releasing.md`, "The first publication stopped as undeterminable").
- `release.yml` and `release-probe.yml` have never run (they need the default branch / a tag). The artifact
  hand-off between `build` and `publish`, `docker load` after archive verification and the publish job's
  draft-Release visibility are therefore unobserved on GitHub. PR-time checks covered the scripts (100 unit tests),
  a local-registry publish test, the image smoke and actionlint/shellcheck.
- podman and arm64 are untested / out of scope.
- Closeout learning still to fill in after the first tag: the first publication's result and the real GHCR
  answer for a missing package.
