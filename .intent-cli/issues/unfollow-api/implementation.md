# unfollow-api Implementation Packet

## Goal

外向き unfollow REST API(署名付き Undo(Follow) 配送)と REST followers/following 一覧を
Emumet に追加する。Ratcap `follow-management` の先行条件(backlog #1、2026-08-11 決定)。

## Why

現状は Follow 送信 REST と Undo(Follow) 受信のみで、ローカルユーザー発の unfollow 経路がなく、
BFF 向けの REST フォロー一覧も存在しない。Ratcap 側の slice をブロックしているため最優先。

## 設計ノート(2026-08-12 コード調査に基づく)

- **Follow はイベントソーシング非対象**の純 CRUD。`kernel/src/entity/follow.rs` の
  `Follow { id, source, destination, approved_at: Option<FollowApprovedAt> }` を
  `FollowRepository`(find_followings/find_followers/create/update/delete)で操作する。
- **Undo 配送は `send_follow` のミラー**: `application/src/service/activitypub/outbound_follow.rs` の
  `SendFollowUseCase::send_follow` と同じ骨格で、
  「対象 follow 検索 → Undo Activity 構築(type "Undo"、object に元 Follow Activity を
  `serde_json::Value` でネスト) → `delivery.rs` の `deliver_activity_to_inbox(..., "Undo")`
  → 成功後に `follow_repository().delete` + outbox に activity_type "Undo" 記録」とする。
- **配送失敗時の方針**: `send_follow` は失敗時に follow 行を delete してロールバックする。
  unfollow 側は逆に「配送失敗時は follow 行を**残す**」のが自然(解除が未達なのに
  ローカルだけ解除されると不整合)。acceptance criteria に明記済み。
- **REST 一覧の approved フィルタ**: `PostgresFollowRepository.find_followers` は SQL で
  `approved_at IS NOT NULL` 済みだが、`find_followings` は pending も返す。REST 一覧では
  following も承認済みのみに絞る(AP コレクションの total_items と整合)。
- **ルート構成テンプレート**: block/mute(issue #16 / PR #17)に倣う。
  `server/src/route/account/mod.rs` の `AccountRouter::route_account()` に 3 ルート追加、
  `server/src/schema/account.rs` にリクエスト/レスポンススキーマ追加(一覧は
  `RelationListResponse`/`RelationResponse` パターン踏襲)、`openapi.rs` 登録 +
  `openapi.json` 再生成。
- **認証・権限**: 既存同様 `auth_middleware` → `resolve_auth_account_id` → ユースケース内
  `check_permission(account_sign)`(Keto)。
- **unfollow のリクエスト形**: 既存 follow が `FollowAccountRequest { target }`(actor URL or
  acct)なので、unfollow も `target` 指定に揃えるのが対称で自然。ローカル相手の場合は
  配送なしで行削除のみ。

## Scope

- `application/src/service/activitypub/` に外向き unfollow ユースケース追加
- `application/src/transfer/` に unfollow 用 DTO 追加
- `server/src/route/account/` に unfollow ハンドラ + followers/following 一覧ハンドラ追加
- `server/src/schema/account.rs`、`server/src/openapi.rs`、`openapi.json` 更新
- `server/tests/e2e_ap_mock.rs` に Undo 配送 E2E 追加(S3 ミラー)

## Out of scope

- follow 送信 API / Undo 受信処理の変更
- 一覧のページネーション
- pending フォロー取り下げ API
- Ratcap 側 `follow-management` 実装

## Verification

- `cargo test --workspace`(実 DB)グリーン + 新規 DB 振る舞いテスト
- `e2e_ap_mock` で Undo 配送 + 署名ヘッダ検証(`--ignored --test-threads=1`)
- `write_openapi_spec_to_file -- --ignored` で openapi.json 再生成、diff コミット
- `cargo fmt --check` / clippy / `git diff --check` クリーン

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/emumet/features/ap-federation/overview.md` 残スコープ項目。
  完了時に実装済みスコープへ移動し `packets.md` に issue リンク追記(host-only)。
- ADR candidate: none
- Diagram candidate: none
- Docs update: none
- Closeout learning: 配送失敗時の follow 行保持方針は受け入れ基準に明記済み。追加の
  write-back は不要(write_back_required: false)。
- Guide reachability (G645): role-facing surface の追加なし
  (`no_role_facing_surface: true` 相当)。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
