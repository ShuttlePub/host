# block-mute-followups: inbox Block/Undo(Block) テスト拡充 + Iceshrimp E2E S10 Undo(Block) 相手側観測 assert

## Goal

PR #23 (block-mute-federation) のレビュー観測事項 3 件 (非 blocking) を消化する
テスト強化スライス。重複 Block 配送の no-op 性を実 DB テストで固定し、inbox
Block/Undo(Block) ハンドラのエラーパス単体テストを拡充し、Iceshrimp E2E S10 に
Undo(Block) の相手側観測ポーリング assert を追加する。本番コードの挙動変更は
行わない。

## Why This Slice Exists Now

Block 連合の実装は PR #23 + Stage 9 re-apply (PR #42) で完了したが、レビュー
観測事項が features/block-mute/decisions.md (2026-08-13) に未消化で残っている。
重複 Block 配送時の no-op 性は tx abort に依存する繊細な設計で、テストによる
固定がないと将来のリファクタで壊れやすい。

## Current Observed State

- handle_block_activity は insert_if_absent の戻り値で first-delivery ガード
  済み (handlers.rs:293) だが、重複配送が no-op であることを示すテストがない
- handlers.rs の既存単体テストは 4 件で純粋関数中心。エラーパス
  (他人 inbox 宛・不正 object・unknown actor) は未検証
- Iceshrimp E2E S10 は unblock の 204 (signed Undo(Block) 配送) まで検証するが、
  Iceshrimp 側が Undo(Block) を処理したことの外部観測はない

## Accepted Baseline You May Assume

- 重複 Block は tx 内 INSERT 失敗 (23505) → tx abort → commit-as-rollback で
  no-op となる設計 (handlers.rs:290-301)。この設計は変更しない
- handle_undo_block_activity は unknown remote actor で Ok(()) early return、
  delete_if_exists で冪等
- ハンドラ級モックは collections.rs の MockModule パターンに倣う
- Mastodon E2E (PR #47) の wait_for_* ポーリング helper が相手側観測の先例

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `application/src/service/activitypub/inbox/handlers.rs, server/tests/e2e_ap_iceshrimp.rs, server/tests/support/iceshrimp.rs, driver/src/database/postgres`

Target part: `inbox Block/Undo(Block) ハンドラのエラーパス/重複配送テスト + Iceshrimp E2E S10 の Undo(Block) 相手側ポーリング検証`

## In Scope

- 重複 Block no-op の実 Postgres 統合テスト (2 回配送で Ok・follow 再解除なし)
- inbox Block/Undo(Block) エラーパス単体テスト (他人 inbox 宛 / 不正 object /
  unknown actor)
- Iceshrimp E2E S10 への Undo(Block) 相手側観測ポーリング assert 追加 +
  support/iceshrimp.rs のポーリング helper

## Out Of Scope

- 再フォロー防止機構 (別設計)
- outbound Block/Undo(Block) 側の変更
- 本番コードの挙動変更 (テストと観測の強化のみ)

## Standalone Child Issue Contract

Emumet の inbox Block/Undo(Block) 処理について、テストと観測を強化する。
(1) 同一 Block アクティビティの 2 回配送が no-op (handler は Ok、follow 再解除は
再実行されない) であることを実 Postgres 統合テストで固定する。(2) inbox
Block/Undo(Block) ハンドラのエラーパス単体テスト (他人 inbox 宛の拒否、object が
actor id でない / Block でない場合の Rejected、unknown remote actor) を
collections.rs の MockModule パターンで追加する。(3) Iceshrimp E2E S10 の
unblock 後に、Iceshrimp 側で Block 状態が解消されたことをポーリングで外部観測
する assert を追加する (support/iceshrimp.rs に wait_for_* 系 helper を新設)。
本番コードの挙動は変更しない。

## Acceptance Criteria

- 重複 Block 配送 no-op の実 DB 統合テストが追加されグリーン
- エラーパス単体テスト (他人 inbox 宛 / 不正 object / unknown actor) が追加される
- Iceshrimp E2E S10 に Undo(Block) 相手側観測ポーリング assert が追加される
- `bash e2e/run-ap-e2e.sh` (CI e2e.yml 相当) がグリーン

## Verification

- `cargo test` (unit + integration)
- `bash e2e/run-ap-e2e.sh` (Iceshrimp S10 含む)
- `git diff --check`

## Related Links

- intent: intents/emumet/features/block-mute/decisions.md
  (2026-08-13 フォローアップ候補)
- 先例: PR #47 (mastodon-e2e-undo-coverage) のポーリング helper

## Knowledge Maintenance

- Intent placement: features/block-mute/decisions.md / none new
- ADR candidate: none
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes — decisions.md のフォローアップ候補 3 件を
  消化済みと更新 (host-side)

## Guide Reachability (G645)

No role-facing surface (テストのみのスライス。packet.yaml guide_reachability で
`no_role_facing_surface: true` を宣言)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
