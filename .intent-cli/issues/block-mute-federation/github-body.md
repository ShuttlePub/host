# Block アクティビティ連合 (送信 Block/Undo(Block) + inbox 受信処理) + E2E

## Goal

ローカル → リモートへのブロック/解除を署名付き Block / Undo(Block) アクティビティ
として相手 inbox へ配送し、inbox で受信した Block / Undo(Block) をローカルの
block 状態とフォロー関係へ反映する。mock peer / Iceshrimp E2E にブロック連合
シナリオを追加する。

## Why This Slice Exists Now

block-mute-core (issue #16 / PR #17) でローカルのブロック/ミュート基盤
(エンティティ・Repository・REST API・双方向フォロー解除) が完成し、feature
block-mute の残スコープは ActivityPub 連合のみ。本 slice で feature の
acceptance criteria が完結する。

## Current Observed State

- Block/Mute エンティティ (local/remote 識別の source/destination 構造)、
  BlockRepository/MuteRepository、REST API (作成/一覧/解除) は実装済み
- block_account はリモート相手でもローカル状態の作成とフォロー解除のみ行い、
  相手 inbox への Block アクティビティ配送は行わない
- inbox (application/src/service/activitypub/inbox/mod.rs) の dispatch は
  Follow / Accept / Undo(Follow) のみで、Block / Undo(Block) は未処理
- ブロック連合の E2E シナリオは存在しない

## Accepted Baseline You May Assume

- 署名付き配送は application/src/service/activitypub/delivery.rs の
  deliver_activity_to_inbox が唯一の窓口
- 外向き配送 + outbox 記録は outbound_unfollow.rs のパターンに倣う
  (Activity 構築 → deliver_activity_to_inbox → ローカル状態更新 →
  OutboxActivity 記録)
- Activity は generic 型 (type_: String) のため Block 専用型の新設は不要
- リモートアクター解決は remote_actor.rs の既存関数を流用
- Mute は連合に通知しない (ローカルのみ)
- Block は純粋 CRUD を継続 (Event Sourcing 対象にしない)

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `application/src/service/activitypub/, application/src/service/block.rs, application/src/transfer/, server/tests/e2e_ap_mock.rs, server/tests/e2e_ap_iceshrimp.rs`

Target part: `外向き Block/Undo(Block) 配送ユースケース + inbox の Block/Undo(Block) ハンドラ + ブロック連合 E2E`

## In Scope

- block_account での外向き Block 配送 (destination が remote の場合) + outbox 記録
- unblock_account での外向き Undo(Block) 配送 (destination が remote の場合)
  + outbox 記録
- inbox の Block ハンドラ (remote→local block 作成 + 双方向フォロー解除への反映)
- inbox の Undo(Block) ハンドラ (該当 block の削除)
- inbox/mod.rs への dispatch 分岐追加
- mock peer / Iceshrimp E2E へのブロック連合シナリオ追加

## Out Of Scope

- Mute の連合
- ブロック成立時の Reject(Follow) 送信
- ブロック/ミュートに基づく投稿・タイムラインのフィルタリング
- リモートアクター解決のキャッシュ戦略変更

## Standalone Child Issue Contract

Emumet のブロック機能に ActivityPub 連合を追加する。ローカルアカウントが
リモートアカウントをブロックした際は署名付き Block アクティビティを相手 inbox
へ配送して outbox に記録し、ブロック解除時は署名付き Undo(Block) を配送する。
inbox で Block を受信した際は remote→local の block 状態を作成して双方向の
フォロー関係を解除し、Undo(Block) 受信時は該当 block を削除する。配送・受信
ともに既存の outbound_unfollow / inbox ハンドラのパターンに倣い、mock peer と
Iceshrimp の E2E にブロック連合シナリオを追加して動作を検証する。

## Acceptance Criteria

- リモートアカウントへのブロックで署名付き Block が相手 inbox に配送され、
  outbox に記録される (mock peer E2E で検証)
- ブロック解除で署名付き Undo(Block) が相手 inbox に配送される
- inbox で受信した Block がローカルの block 作成と双方向フォロー解除に反映される
- inbox で受信した Undo(Block) が該当 block の削除に反映される
- 配送失敗時のローカル状態遷移・エラー返却が outbound_unfollow の既存パターンと
  一貫している
- Mock peer E2E と Iceshrimp E2E にブロック連合シナリオが追加される

## Verification

- mock peer E2E: Block / Undo(Block) の配送検証
- inbox ハンドラのテスト: Block 受信 → block 作成 + フォロー解除、
  Undo(Block) 受信 → block 削除
- Iceshrimp E2E: 実リモート実装との相互運用
- `git diff --check`

## Related Links

- feature: intents/emumet/features/block-mute/ (host repo)
- 前提: block-mute-core — https://github.com/ShuttlePub/Emumet/issues/16 /
  https://github.com/ShuttlePub/Emumet/pull/17
- TODO 元: https://github.com/ShuttlePub/Emumet/issues/2

## Knowledge Maintenance

Optional (G461). Tells the implementer/reviewer whether intent / ADR / diagram / docs
writeback is expected for this slice. Answer or explicitly decline:

- Intent placement: features/block-mute/packets.md への issue リンク追記と
  acceptance.md の連合項目チェック、decisions.md への Mute 非連合の確定記録
  (host-only、完了時)
- ADR candidate: none (feature スコープの決定は features/block-mute/decisions.md へ)
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: no

## Guide Reachability (G645)

本 slice は新規の role-facing surface を追加しない。REST API (block-mute-core) と
inbox エンドポイントは既存であり、追加するのはその背後の連合振る舞いのみ
(`no_role_facing_surface: true`)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
