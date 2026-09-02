# AGENTS.md — host repo working policy

This is an **intent host repository**. It owns durable parent state for the
`emumet` domain under `.intent-cli/` and `intents/emumet/`.
Child implementation repos do NOT own this state.

- Host repo (this repo): `ShuttlePub/host`
- Target repo (child implementation): `ShuttlePub/Emumet`
- Domain: `emumet`
- Bootstrapped by `intent-cli intent init` (G293 / G301).

## Host repo working policy

- Work directly on `main`. Do NOT open a PR for routine host-state updates
  (queue-state, runs.jsonl, packets, intents/) unless the operator explicitly
  asks for one.
- `git pull --ff-only` before edits. Commit and push to `main` after each
  coherent change.
- All workflow label transitions go through installed `intent-cli automation`
  / `intent-cli worker` commands. Never edit GitHub labels by hand.
- Routine collaboration uses `intent-cli guide ...`. Do NOT read
  `intents/rules/**`, copied prompt files, or local skill files that restate
  workflow for routine operation.
- CARVE-OUT: the CLI-owned `intent-cli` dispatcher skill installed by `intent-cli skill install` is PERMITTED — it restates no workflow, is single-sourced from this CLI with `intent-cli skill diff` drift detection, and is distributed only by `intent-cli skill install`. Local skill files that restate workflow (`gh-issue-to-pr`, `gh-fix-pr-comment`, copied runbooks) remain forbidden.
- Do NOT call `intent-cli run` (advanced runtime) or `dotnet run` as a
  fallback. Do NOT ask `intent-cli` to launch Claude/Codex.

## intent-cli knowledge recovery (post-compression)

- `intent-cli` is **self-describing**: never answer intent-cli command /
  concept questions from conversation memory alone. Resolve them from the CLI
  itself first — `intent-cli --help`, `intent-cli guide commands list`,
  `intent-cli <group> --help` (guide / worker / automation / packet / issue /
  closeout / interview), and per-topic guides such as `intent-cli grill`,
  `intent-cli inspect`, `intent-cli stack`, `intent-cli improve`,
  `intent-cli next`.
- Interview / guide protocols (`grill`, `inspect`, `stack`, `improve`, `next`)
  are durable G-numbered guides owned by the CLI, not by this repo. The CLI is
  the single source of truth; a stale recalled summary is a bug, re-fetching
  from the CLI is the fix.
- When compressing long sessions, keep at most this one pointer in the
  summary; do NOT copy command catalogs into summaries (they go stale).

## intent-cli known drifts & verified interfaces (ledger)

Hard-won operational findings that compression must NOT lose. Each entry is
pinned to the verified binary version + date. Entries are append-only;
remove an entry only after verifying against a newer binary.

- **Dual-check rule** (verified 0.26.0, 2026-08-30): for any unfamiliar
  intent-cli workflow, consult BOTH `intent-cli <cmd> --help` (what the
  binary implements) AND `intent-cli guide <topic>` / `intent-cli grill`
  (the documented protocol). A contradiction between them is a real finding:
  the binary wins for execution, and the drift is a bug-report candidate.
  Neither source alone reveals the contradiction.
- **interview record-answer** (verified 0.26.0, 2026-08-30): the binary
  rejects the guide-documented `--question-id <id> --answer "..."` form.
  Implemented form: `record-answer --session <id> --question <q> --from-file
  <path> --write` (new questions additionally need `--prompt <text>`;
  re-answering an existing id does not). `next-question` requires
  `--session` (the guide-documented `--domain`-only form errors).
  `interview answer --domain <d> [--from-file <path>]` answers the next
  pending question.
- **grill protocol** (verified 0.26.0, 2026-08-30): `intent-cli grill` is
  persistent interview mode — the agent owns semantic questioning; one
  focused question per turn (never batch); dependency-ordered backlog;
  record every answer durably before proceeding; stop only at a structured
  stop condition (backlog empty + rediscovery finds nothing →
  `今のところ追加質問はありません`).
- **record-answer domain default hazard** (verified 0.26.0, 2026-08-30):
  `interview record-answer --session <id>` WITHOUT `--domain <d>` silently
  resolves the session under the host's default domain (here: emumet),
  creating a stray `<default-domain>/interviews/<id>.json` with no warning
  even when the session name matches another domain. Fix: ALWAYS pass
  `--domain <d>` explicitly on multi-domain hosts; check the printed
  `session path` in the output; delete any stray file under the wrong
  domain immediately.
- **packet revision after publish** (verified 0.26.0, 2026-08-30): no
  intent-cli command revises an already-published packet/issue (`packet
  draft` never overwrites existing files; no retitle/update command exists
  in the binary's `packet`/`intent`/`issue` groups). Verified path: hand-edit
  the packet files under `.intent-cli/issues/<unit>/`, hand-edit
  `queue-state.json` (jq), then sync the GitHub issue with `gh issue edit
  --title --body`. Record a revision-history note in the packet so the
  divergence from the originally published body is auditable.
- **issue publish-flow title fallback** (verified 0.26.0, 2026-08-30):
  `issue publish-flow` created the issue with `title_source:
  "fallback-untitled"` ("drive-web-ui (untitled)") even though packet.yaml
  carried a valid `issue_title` — the identical structure resolved correctly
  for drive-foundation#1 earlier. Root cause not isolated (candidate: strict
  YAML schema silently falling back on unknown keys such as
  `revision_history`). Fix: after publish-flow, check the `title-fallback`
  warning in the JSON output and retitle with `gh issue edit` BEFORE
   `automation issue-publish` (pre-boundary hand-fix, same precedent as the
   packet-revision entry). Also: pass `--repo` owner-qualified
   (`ShuttlePub/shuttlepub-frontends`); a bare repo name resolves against the
   operator's personal account.
- **notify supervise install PATH hazard** (verified 0.27.1, 2026-08-31): the
  generated systemd unit uses `ExecStart=/usr/bin/env intent-cli ...`, but the
  systemd user environment PATH does not include the direnv-provided intent-cli,
  so the unit crash-loops with exit 127 (`status=217`/`203`-adjacent env lookup
  failure). Fix: create a drop-in overriding ExecStart to
  `/run/current-system/sw/bin/nix develop <host-root> --command intent-cli
  notify supervise ...` (same args as the generated unit), e.g. under
  `~/.config/systemd/user/<unit>.service.d/override.conf`; a copy of the
  override is kept at
  `.intent-cli/supervision/<domain>/<team>/install/service.d/override.conf`
  for review. `/nix/var/nix/profiles/default/bin/nix` did not exist on this
  host — use the path verified with `command -v nix` in a login shell.
- **supervise install first-cycle-proof failure + ExecStart drift** (verified
  0.27.1, 2026-09-02): on 0.27.1 the generated unit's ExecStart pins the
  nix-store absolute path of the installing binary plus an embedded
  `--bash-executable <nix-store bash>` (no longer `/usr/bin/env intent-cli`),
  so the drop-in override from the previous entry remains necessary — keep
  overriding ExecStart with `nix develop <host-root> --command ...`. Also,
  `notify supervise install --write` fails its first-cycle proof
  (`first-cycle-proof-failed`: the managed supervisor proc never writes a
  first cycle within the 30s `--startup-bound`, and no child log is even
  created — suspected CLI/Linux bug, report candidate upstream), yet ALL
  artifacts (install/<unit>.service, bound.json, emission-policy.json) are
  still produced and a manual one-shot supervision run succeeds and appends
  to cycles.jsonl. Procedure that works: run install, IGNORE the proof
  failure, write the drop-in override, register via systemd (the long-run
  unit cycles fine when systemd owns the process). Verified on both
  booskiff-main and booskiff-frontends teams (2026-09-02).

## Wrong-host detection (G301)

`.intent-cli/host-binding.toml` records the canonical host repo for this
domain. If you operate this domain from a different host repo, expect
`intent-cli` to surface a structured wrong-host warning with remediation
steps; do not silently proceed with parent-state mutation.
