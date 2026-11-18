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
- Tag protection (ruleset, `v*`: restrict updates and deletions): agreed in principle; it was not
  configured at the time of this initial record. See the readiness verification below.

## Not done / pending (each needs the user's explicit approval)

1. Push the first `v*` tag (runs `release.yml`: validate → gate → build → publish/verify → release).
2. Change the new GHCR package from private to public, then verify an anonymous pull by tag and digest.

## Facts and unobserved behaviour

- GHCR with an **anonymous** request for the not-yet-existing package answers like a private one:
  manifest GET -> 401 `UNAUTHORIZED`, token request -> `DENIED` (observed 2026-11-17). The authenticated
  missing-package answer is recorded in the readiness verification below; see `docs/releasing.md`,
  "The first publication stopped as undeterminable", for the classifier's recovery procedure.
- Before the readiness verification below, neither workflow had run. The read-only probe has now run;
  `release.yml` has not. The artifact hand-off between `build` and `publish`, `docker load` after archive
  verification and the publish job's draft-Release visibility remain unobserved on GitHub. PR-time checks
  covered the scripts (100 unit tests), a local-registry publish test, the image smoke and
  actionlint/shellcheck.
- podman and arm64 are untested / out of scope.
- Closeout learning still to fill in after the first tag: the first publication's result. The authenticated
  GHCR answer for a missing package is recorded in the readiness verification below.

## Release-readiness verification (2026-11-18; user-approved in thread-xxs52dcx)

The following checks were completed before a release. This supersedes the pending state above for
items 1 and 2, and updates the previously unobserved authenticated GHCR response:

- **Tag ruleset configured and read back via API:** repository ruleset `Protect release tags v*`, ID
  `27521989`; target `tag`; refs `refs/tags/v*`; enforcement `active`; rules `deletion` and `update`
  only (tag creation remains allowed); bypass is RepositoryRole actor ID `5` (Repository admin) with
  `always`. No same-purpose ruleset existed before creation.
- **Read-only release probe:** [workflow run](https://github.com/ShuttlePub/Emumet/actions/runs/44240174857)
  (`workflow_dispatch`, main at `1259c731af496bb09ae11286a9b869b132a88f4d`) completed successfully.
  The workflow has no inputs and queried its fixed never-published version. Authenticated token request:
  HTTP `200`, `codes=[]`; GHCR manifest GET for `probe-never-published`: HTTP `404`,
  `codes=['MANIFEST_UNKNOWN']`; `publish-release.py` concluded
  `classify: absent (MANIFEST_UNKNOWN on HTTP 404)`. This is an explicit `absent` classification,
  not an indeterminate result.
- **No release was made, by the user's decision:** no tag was created or pushed, no GHCR image was
  pushed, `release.yml` was not run, and package visibility was not changed. The user deferred the
  release because additional implementation may be needed; only the requested pre-release checks were
  performed.
