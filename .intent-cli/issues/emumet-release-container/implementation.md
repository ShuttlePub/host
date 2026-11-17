# emumet-release-container Implementation Packet

## Goal

Emumet に server 専用の非 root コンテナイメージと、PR での検証 (ビルド + smoke、公開なし)、`v*` の CalVer タグからの GHCR 公開と GitHub Release、手順書を 1 つの PR で入れる。本番コードの変更は `/healthz`・SIGTERM/SIGINT の graceful shutdown・`EMUMET_FILE_LOG_ENABLED` の 3 点に限る。

## Why

Dockerfile・公開 CI・タグ・Release がなく本番を動かせない (P4 の残課題)。ユーザーが範囲を決めた (一般公開、amd64 のみ、CalVer、SIGTERM 対応、ファイルログの既定停止)。

## Scope

- Dockerfile・`.dockerignore`・`/healthz`・停止処理・ファイルログ・smoke・検証/公開 script とテスト・2 つの workflow・手順書。詳細と受け入れ基準 C1〜C18 は GitHub issue 本文 (`github-body.md`) を正とする。
- 設計制約 (host の thread-xxs52dcx にある計画 run-01m7mwcengxsfggtwmgpa7rcmy とレビュー run-01m7mwvqb0ymt0bcsn6x7d43fe の C1〜C18、N1〜N8) に従う。特に C2 (`route/tests.rs:813-881` 無変更、`tokio::spawn` 不使用) と C6 (`EMUMET_FILE_LOG_ENABLED` は環境変数のみ)。

## Out of scope

- 本番配置、k8s、Kratos/Hydra の本番設定、frontends、共通 workflows、ruleset 設定、タグ push、GHCR 公開、マージ。

## Verification

cargo fmt/clippy/test (DB テスト含む)、docker build + smoke、`scripts/tests/`、actionlint、PR CI 全緑。`git diff --check`。

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/intent-tree/00-map.md`。release 用の新ノード (`intents/emumet/operations/release.md`) が必要。
- ADR candidate: 辞退 (CalVer の決定は operations/release.md に記録する)。
- Diagram candidate: 辞退。
- Docs update: Emumet の `docs/releasing.md`・`docs/container-runtime.md`・`CLAUDE.md`。
- Closeout learning: CalVer の日付基準の最終決定、初回公開の結果、GHCR の package 未作成時の実応答。`write_back_required: true`。

- Guide reachability (G645): 運用者向けの `docs/releasing.md` と `docs/container-runtime.md` を route (guide surface: implementation-loop、role: implementation)。
