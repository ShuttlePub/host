## Goal

実 Mastodon サーバーとの E2E (`server/tests/e2e_ap_mastodon.rs`) に Undo(Follow) 相互運用
シナリオ (S10) を追加する。S7 (Mastodon→Emumet Follow) / S8 (Emumet→Mastodon Follow) で
確立した双方向のフォロー関係に対し、(1) Emumet ローカルユーザーが unfollow REST
(`POST /api/v1/accounts/{account_id}/unfollow`) で Undo(Follow) を Mastodon へ配送する
方向と、(2) Mastodon ユーザーが unfollow して Mastodon から Emumet inbox へ Undo(Follow)
が配送される方向の、両方が実機で正しく動くことを CI で常時検証できるようにする。

## Why This Slice Exists Now

2026-08-12 の C4 grill で「ActivityPub 連合の疎通保証は Mastodon 実サーバーとの E2E を
CI で常時検証するレベル」と確定し、S7-S9 の実装済みが確認された。同時に残余ギャップ
「CI の Mastodon E2E は Undo(Follow) の相互運用をカバーしていない」が特定され、packet
backlog #11 として登録された。Undo(Follow) 配送 (unfollow-api / PR #21) と inbox 受信
処理は実装済みだが、実 Mastodon 相手の退行を検出する手段がなく、フォロー解除が連合で
反映されない不具合が入っても CI が気づけない。

## Current Observed State

- `server/tests/e2e_ap_mastodon.rs` の `mastodon_full_federation_scenario` は S7-S9
  (Follow 双方向 + Create/Note 配送) のみで、Undo(Follow) のステップを持たない。
- 外向き unfollow REST (`POST /api/v1/accounts/{account_id}/unfollow`、成功 204 /
  配送失敗 422 / 関係なし 404) は実装済みで、mock peer 向け E2E
  (`e2e_ap_mock.rs` の `outbound_unfollow_sends_undo_to_remote_inbox`) で Undo 配送は
  検証済み。しかし実 Mastodon 相手の検証はない。
- inbox 側 `handle_undo_follow` も実装済み・冪等 (characterization test あり) だが、
  実 Mastodon からの Undo(Follow) 受信の E2E はない。
- Mastodon 側ヘルパーに不足がある: `MastodonClient` (server/tests/support/mastodon.rs)
  に `unfollow_account` メソッドがなく、mastodon_setup.rs にも followers/following の
  「不在」ポーリング (contains 系のみ存在) がない。Iceshrimp 側には
  `wait_for_iceshrimp_followers_absent` (iceshrimp_setup.rs) の前例がある。

## Accepted Baseline You May Assume

- 外向き Undo(Follow) 配送と inbox での Undo(Follow) 受信処理は実装済みであり、
  本スライスで本体コードを変更する必要はない (テスト追加のみのスライス)。
- Mastodon E2E は `mastodon_full_federation_scenario` 単一テストが S7-S9 を結合実行する
  形式で、新ステップもこのテスト内に S10 として追加する (Iceshrimp S10 と同型)。
- E2E ランナー `e2e/run-ap-e2e.sh` の section 13 が既に e2e_ap_mastodon を実行して
  おり、同ファイルへの追記はランナー/CI 変更不要で CI に乗る。
- `post_unfollow` (account_helper.rs)、`wait_for_mastodon_followers_contains` /
  `wait_for_emumet_collection_count` (mastodon_setup.rs) 等の既存ヘルパーはそのまま
  利用できる。
- 実サーバー Undo 相互運用の前例は Iceshrimp S10 (Block/Undo(Block)、
  e2e_ap_iceshrimp.rs) で、ヘルパー構成・ポーリング方針はこれに倣う。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `server/tests/e2e_ap_mastodon.rs`, `server/tests/support/mastodon.rs`,
`server/tests/support/mastodon_setup.rs`, `README.md`

Target part: Mastodon E2E S10 (Undo(Follow) 相互運用) ステップ + Mastodon クライアント/
ポーリング ヘルパー追加 + シナリオ一覧ドキュメント更新

## In Scope

- `server/tests/e2e_ap_mastodon.rs`: `mastodon_full_federation_scenario` の S9 後に
  S10 ステップを追加 (双方向 Undo(Follow)。ファイルヘッダのシナリオ表記も更新):
  1. Emumet→Mastodon: `post_unfollow` が 204 を返し、Mastodon 側 followers から
     Emumet actor が消え、Emumet 側 following コレクション totalItems が 0 に戻る。
  2. Mastodon→Emumet: Mastodon REST unfollow により Emumet inbox が Undo(Follow) を
     処理し、Emumet 側 followers コレクション totalItems が 0 に戻る (および Mastodon
     側 following からの消失)。
- `server/tests/support/mastodon.rs`: `MastodonClient::unfollow_account(account_id, token)`
  を追加 (`POST /api/v1/accounts/{id}/unfollow`。既存 `follow_account` のミラー)。
- `server/tests/support/mastodon_setup.rs`: `wait_for_mastodon_followers_absent`
  (必要に応じ `wait_for_mastodon_following_absent`) を追加
  (`wait_for_iceshrimp_followers_absent` のパターンに倣うポーリング)。
- `README.md`: シナリオ一覧に Mastodon S10 (Undo(Follow)) の行を追加。

## Out Of Scope

- 本体コード (application/, kernel/, server/src/) の変更。相互運用の失敗が本体バグに
  起因する場合は、PR 本文に再現手順と証跡 (ログ/レスポンス) を添えて報告し、修正は
  別スライスとする (本 PR で抱え込まない)。
- Mastodon 向け Undo(Block) / Accept / Reject / pending フォロー取り下げの E2E。
- `e2e_ap_mock.rs` / `e2e_ap_iceshrimp.rs` の変更。
- E2E ランナー (`e2e/run-ap-e2e.sh`) / CI (`.github/workflows/e2e.yml`) /
  compose ファイルの変更。

## Standalone Child Issue Contract

`ShuttlePub/Emumet` の `server/tests/e2e_ap_mastodon.rs` に、実 Mastodon 相手の
Undo(Follow) 相互運用ステップ (S10) を追加する PR を 1 本作成する。S7/S8 で確立する
双方向フォローに対し、(1) Emumet の unfollow REST 経由で Undo(Follow) を Mastodon へ
配送し Mastodon 側 followers から消えること、(2) Mastodon REST の unfollow で
Mastodon から Emumet inbox へ Undo(Follow) が届き Emumet 側 followers が減ること、を
ポーリングヘルパーで外部観測アサートする。あわせて `MastodonClient::unfollow_account`
と `wait_for_mastodon_followers_absent` (必要に応じ following 版) のヘルパーを support
モジュールに追加し、README.md のシナリオ一覧に S10 行を追記する。本体コードには
触れず、`bash e2e/run-ap-e2e.sh` (CI 相当) がグリーンであることを証跡として示す。

## Acceptance Criteria

- `mastodon_full_federation_scenario` に S10 (Undo(Follow)) ステップが追加され、
  `bash e2e/run-ap-e2e.sh` (CI `.github/workflows/e2e.yml` と同一経路) がグリーン。
- Emumet→Mastodon 方向: `post_unfollow` が 204 を返し、Mastodon 側 followers 一覧から
  Emumet actor が消失し、Emumet 側 following コレクションの totalItems が 0 に戻ることを
  テストがアサートしている。
- Mastodon→Emumet 方向: Mastodon REST の unfollow により Emumet inbox が Undo(Follow)
  を処理し、Emumet 側 followers コレクションの totalItems が 0 に戻ることをテストが
  アサートしている。
- `MastodonClient` に `unfollow_account` メソッド、mastodon_setup に
  `wait_for_mastodon_followers_absent` (および必要なら `wait_for_mastodon_following_absent`)
  ヘルパーが追加されている。
- `README.md` のシナリオ一覧に Mastodon 向け S10 (Undo(Follow)) の行が追加されている。
- 本体コード (application/, kernel/, server/src/) に diff がない。

## Verification

- `bash e2e/run-ap-e2e.sh` グリーン (CI e2e.yml と同一経路。section 13 が
  `cargo test -p server --test e2e_ap_mastodon -- --ignored --test-threads=1 --nocapture`
  を実行)。CI の実行結果を PR から確認できること。
- Mastodon 単体実行: `EMUMET_E2E_EXTERNAL_SERVER=1 cargo test -p server --test e2e_ap_mastodon -- --ignored --test-threads=1 --nocapture`
  (前提コンテナは run-ap-e2e.sh が用意)。
- `cargo fmt --check` / `cargo clippy --workspace --all-targets -- -D warnings` クリーン。
- `git diff --check` クリーン。

## Related Links

- 前段スライス: unfollow-api (PR ShuttlePub/Emumet#21、外向き Undo(Follow) REST)
- 直近先例: Iceshrimp S10 Block/Undo(Block) E2E (`server/tests/e2e_ap_iceshrimp.rs`)
- 起点: 2026-08-12 C4 grill (Emumet REST API の Mastodon 互換方針) の残余ギャップ特定

## Knowledge Maintenance

Optional (G461). Tells the implementer/reviewer whether intent / ADR / diagram / docs
writeback is expected for this slice. Answer or explicitly decline:

- Intent placement: ap-federation (host 側 closeout で backlog/overview を更新) 
- ADR candidate: none
- Diagram candidate: none
- Docs update: none (README.md のシナリオ表更新は本 PR の in-scope 作業)
- Closeout writeback expected: no

## Guide Reachability (G645)

本スライスはテスト追加のみで、新たな role-facing surface を追加しない
(`no_role_facing_surface: true` 相当)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
