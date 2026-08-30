---
# Automation bindings for the `ratcap` intent domain (tree-v1).

# Implementation (child) repository this domain's issues target.
# 2026-08-30: RatCap → shuttlepub-frontends へ rename (decisions/2026-08-30-monorepo-extraction.md D1)。
# アプリ資産は apps/emumet-web/ 配下。
child_repo: ShuttlePub/shuttlepub-frontends

# Execution-unit namespace filter used by `next-slice` and
# `automation summary` to select which execution units belong to this
# domain. The default `.*` accepts every execution unit (correct for a
# single-domain host). Narrow it (for example `^ratcap-`) once you
# share a `.intent-cli/issues` root across multiple domains.
execution_unit_regex: .*
---

# ratcap automation bindings

This file maps the `ratcap` intent domain to its implementation
repository and durable automation state. intent-cli reads the
frontmatter fields above; the prose below is for humans and agents.

Ask intent-cli for the next action instead of inspecting source code to
recover first-run setup:

- `intent-cli intent host-check --domain ratcap --format json`
- `intent-cli intent next-slice --dry-run --domain ratcap --format json`
- `intent-cli automation summary --domain ratcap --format json`
