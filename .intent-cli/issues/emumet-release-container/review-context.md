# emumet-release-container Review Context

Review that this slice moves operation toward the documented intent without widening scope.

Flag findings if the implementation:

- widens scope beyond the issue contract;
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
- skips required contract sections.

## Facet context

<!-- BEGIN GENERATED FACET CONTEXT (G530) -->
### vocabulary
- (none overlapping this packet's intent_references)
### invariant
- (none overlapping this packet's intent_references)
### decider
- (none overlapping this packet's intent_references)
### acceptance-property
- (none overlapping this packet's intent_references)
<!-- END GENERATED FACET CONTEXT (G530) -->

## Knowledge Writeback Expectation (G461)

If the packet's `closeout_learning.write_back_required` is `true`, confirm the
expected intent-tree / ADR / diagram / docs writeback landed in this PR or was
captured as a follow-up packet. If the packet declined all knowledge maintenance,
that is acceptable — note it rather than blocking.
## Packet-specific review points

- 変更が C1〜C18 (github-body.md の受け入れ基準) の範囲を超えていないか。特に `server/src/route/tests.rs:813-881` の変更、`tokio::spawn` による停止処理、`.env` 経由の `EMUMET_FILE_LOG_ENABLED`、`openapi.json` の変更、`latest` タグ、既存イメージの上書き、PR CI での registry login/push、マージ・タグ push・ruleset 設定・GHCR 公開の実行。
- PR 本文に、基準の完全な SHA、環境変数の抽出コマンドと分類、smoke の結果、C1〜C18 の検証結果、N3〜N8 の採否、未検証の範囲があること。
