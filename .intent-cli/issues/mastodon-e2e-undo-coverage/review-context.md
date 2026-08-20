# mastodon-e2e-undo-coverage Review Context

Review that this slice moves operation toward the documented intent without widening scope.

## レビューの観点

このスライスは 2026-08-12 C4 grill (intents/emumet/clarifications/open.md) で特定された
残余ギャップ「CI の Mastodon E2E が Undo(Follow) 相互運用をカバーしていない」を埋める
もので、backlog #11 に対応する。以下を確認する:

- PR が issue 契約の 4 ファイル (`server/tests/e2e_ap_mastodon.rs`,
  `server/tests/support/mastodon.rs`, `server/tests/support/mastodon_setup.rs`,
  `README.md`) のみを変更し、本体コード (application/, kernel/, server/src/) や
  他の E2E ファイル (e2e_ap_mock.rs / e2e_ap_iceshrimp.rs)、ランナー/CI/compose に
  手を出していないこと。
- S10 ステップが双方向 (Emumet→Mastodon の unfollow REST と、Mastodon→Emumet の
  Mastodon REST unfollow 経由 Undo(Follow) inbox 処理) を検証していること。
- 「相手側の関係一覧から消える」外部観測 (followers/following の absent ポーリング、
  Emumet コレクション totalItems の復帰) でアサートしており、固定 sleep や
  フレークを招く即時アサートに頼っていないこと。
- 新ヘルパー (`unfollow_account`, `wait_for_mastodon_followers_absent`) が既存の
  `follow_account` / `wait_for_iceshrimp_followers_absent` のパターンを踏襲していること。
- CI (`.github/workflows/e2e.yml` → `bash e2e/run-ap-e2e.sh` section 13) が
  グリーンであることの証跡。
- 相互運用失敗が本体バグに起因する場合に、スコープを広げて本体修正を抱え込まず
  PR 本文で報告する運用に従っていること。

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

`closeout_learning.write_back_required` は false。PR 側に write-back を要求しない。
packet 完了時にホスト側で `intents/emumet/packets/backlog.md` #11 の完了移動と
`intents/emumet/features/ap-federation/overview.md` の実装済み更新を行うことを
closeout 時に確認する。
