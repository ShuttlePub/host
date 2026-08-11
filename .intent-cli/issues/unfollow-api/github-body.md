# 外向き unfollow REST API(Undo(Follow) 配送) + REST followers/following 一覧

## Goal

Emumet に外向き unfollow REST API(ローカルユーザーがフォロー解除すると、リモート相手の
inbox に署名付きで Undo(Follow) を配送する)と、BFF から利用できる REST の
followers/following 一覧 API を追加する。これにより ShuttlePub のフロントエンド
(Ratcap `follow-management`)が、フォロー中・フォロワーの閲覧とフォロー解除を
通常の REST 経路で完結できるようになる。

## Why This Slice Exists Now

Ratcap のアカウント管理画面 `follow-management`(一覧 + unfollow のみ、follow フォームは
後続)の先行条件として 2026-08-11 の slice 順序決定で最優先に置かれた
(ホストコミット f123a05)。現状の Emumet は Follow の「送信」REST(`POST /api/v1/accounts/{id}/follow`)と
Undo(Follow) の「受信」inbox 処理しかなく、ローカルユーザーが自分のフォローを解除する
経路が存在しない。このままだと Ratcap 側の slice がブロックされたまま進めない。

## Current Observed State

- `POST /api/v1/accounts/{account_id}/follow`(署名付き Follow 配送、
  `application/src/service/activitypub/outbound_follow.rs` の `SendFollowUseCase::send_follow`)は実装済み。
- inbox での Undo(Follow) **受信**(`application/src/service/activitypub/inbox/handlers.rs` の
  `handle_undo_follow`)は実装済みだが、**送信**する経路はない。
- followers/following の一覧は ActivityPub コレクション
  (`/ap/accounts/{account_id}/followers|following`、total_items のみ)のみで、
  認証済み BFF 向けの REST 一覧は存在しない。既存の関係性 REST 一覧は block/mute
  (`GET /api/v1/accounts/{account_id}/blocks|mutes`)のみ。
- 実体験としては「一度フォローした相手を、Emumet 経由のクライアントから解除できない」
  「フォロー中の人をアプリ画面上で一覧表示できない」状態。

## Accepted Baseline You May Assume

- Follow は Event Sourcing 対象外の純 CRUD エンティティ
  (`kernel/src/entity/follow.rs`、承認状態は `approved_at: Option<FollowApprovedAt>`)。
- 署名付き配送は `application/src/service/activitypub/delivery.rs` の
  `deliver_activity_to_inbox` が唯一の窓口。Undo も必ずこれを経由する。
- 認証は `/api/v1` 配下の `auth_middleware`(Ory Hydra JWT + JWKS)、権限チェックは
  ユースケース内の `check_permission(account_sign)`(Keto)。
- REST ルート追加は `server/src/route/account/mod.rs` の `AccountRouter` +
  `server/src/openapi.rs` 登録 + `openapi.json` 再生成の 3 点セット。
- block/mute REST(issue #16 / PR #17)が構成テンプレート。本スライスもそれに倣う。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `application/src/service/activitypub/`, `application/src/transfer/`,
`server/src/route/account/`, `server/src/schema/account.rs`, `server/src/openapi.rs`,
`server/tests/e2e_ap_mock.rs`, `openapi.json`

Target part: 外向き Undo(Follow) 配送のユースケース + unfollow REST ハンドラ +
REST followers/following 一覧ハンドラ

## In Scope

- 外向き unfollow ユースケース(仮称 `SendUndoFollowUseCase`): 対象 follow の検索 →
  Undo Activity 構築(type "Undo"、object に元の Follow Activity をネスト) →
  `deliver_activity_to_inbox(..., "Undo")` で署名配送 → 配送成功後にローカル follow 行削除 +
  outbox へ activity_type "Undo" を記録。`send_follow` のフローをミラーする。
- `POST /api/v1/accounts/{account_id}/unfollow` REST ハンドラ(既存 `follow_account` ハンドラの
  ミラー、認証 + 権限チェック必須)。
- `GET /api/v1/accounts/{account_id}/followers` / `GET /api/v1/accounts/{account_id}/following`
  REST ハンドラ。レスポンスは既存 `RelationListResponse`/`RelationResponse` パターンを踏襲
  (必要に応じて follower 用の新スキーマ)。followers は承認済み(`approved_at IS NOT NULL`)のみ、
  following も承認済みのみを返す(AP コレクションのカウントと整合させる)。
- 上記 3 ルートの utoipa 登録 + `openapi.json` 再生成。
- ユースケース/DB の振る舞いテスト(`#[test_with::env(DATABASE_URL)]`)と、
  `server/tests/e2e_ap_mock.rs` への Undo 配送 E2E 追加
  (`outbound_follow_sends_activity_to_remote_inbox` をミラーし、
  `wait_for_activity(&peer, "Undo", ...)` + 署名ヘッダ検証)。

## Out Of Scope

- follow 送信 API 本体の変更(既存 `POST .../follow` はそのまま)。
- inbox での Undo(Follow) 受信処理の変更(実装済み・冪等)。
- リモートからのフォロワー削除通知(Follow 拒否/Reject)や、ローカル相手への unfollow
  通知の扱い。
- 一覧 API のページネーション(本スライスは全件 or 上限付き単純返却でよい。
  カーソル設計は別スライス)。
- pending(未承認)フォローの取り下げ API(別の UX 判断が必要。Ratcap 側も今回不要)。
- Ratcap 側の `follow-management` 実装そのもの(別ホスト packet)。

## Standalone Child Issue Contract

Emumet に、(1) 認証済みローカルアカウントが指定した相手へのフォローを解除し、
リモート相手の場合はその inbox に署名付き Undo(Follow) を配送してからローカルの follow 行を
削除する `POST /api/v1/accounts/{account_id}/unfollow` エンドポイントと、(2) 認証済みリクエストに対し
承認済みのフォロワー/フォロー中一覧を返す `GET /api/v1/accounts/{account_id}/followers` と
`GET /api/v1/accounts/{account_id}/following` の 2 エンドポイントを実装する PR を出す。
いずれも既存の follow/block-mute ルートと同じ認証・権限・エラー規約に従い、OpenAPI 定義と
コミット済み `openapi.json` を更新し、Undo 配送がリモート inbox に届くことを mock peer E2E で
証明するテストを含めること。

## Acceptance Criteria

- `POST /api/v1/accounts/{account_id}/unfollow` が存在し、認証なしでは 401 を返す。
- 自分が管理しないアカウントの unfollow は 403(権限エラー)を返す。
- フォロー関係が存在しない相手への unfollow は 404 または 422(ドメインの既存規約に合わせる)
  を返す。
- リモート相手へのフォロー解除で、相手の inbox に type "Undo"(object に元 Follow Activity)
  の署名付きアクティビティが配送されることが mock peer E2E で確認できる。
- Undo 配送成功後、ローカルの follow 行が削除されている(以後の followers/following 一覧と
  AP コレクション total_items に反映される)。
- 配送失敗時は follow 行が残り(既存 send_follow のロールバック方針に準拠)、呼び出し側に
  エラーが返る。
- `GET /api/v1/accounts/{account_id}/followers` と `.../following` が存在し、認証なしでは 401、
  承認済みフォローのみが返る(pending は含まない)。
- `openapi.json` が再生成され、`openapi_spec_matches_committed_file` テストが通る。
- OpenAPI 駆動の route smoke テストで新ルートが 401 到達性を持つことが自動検証される。

## Verification

- `cargo test --workspace`(実 DB、`DATABASE_URL` 設定下)がグリーン。
- 新規 DB 振る舞いテスト: unfollow ユースケースの行削除、一覧取得が承認済みのみ返すこと。
- `cargo test -p server --test e2e_ap_mock -- --ignored --test-threads=1 --nocapture` で
  Undo 配送 E2E がグリーン(mock peer に Undo が届き署名ヘッダが有効)。
- `cargo test -p server write_openapi_spec_to_file -- --ignored` で openapi.json 再生成、
  diff がコミットに含まれる。
- `cargo fmt --check` / clippy / `git diff --check` がクリーン。

## Related Links

- ホスト intent: `intents/emumet/features/ap-federation/overview.md`(残スコープ: unfollow REST API + REST フォロー一覧)
- backlog: `intents/emumet/packets/backlog.md` #1 `unfollow-api`
- 先行条件の経緯: ホストコミット f123a05(2026-08-11 slice 順序決定)、Ratcap `follow` feature
- テンプレート: Emumet issue #16 / PR #17(block-mute REST)
- 既存実装: `application/src/service/activitypub/outbound_follow.rs`(send_follow)、
  `application/src/service/activitypub/inbox/handlers.rs`(handle_undo_follow 受信)

## Knowledge Maintenance

Optional (G461). Tells the implementer/reviewer whether intent / ADR / diagram / docs
writeback is expected for this slice. Answer or explicitly decline:

- Intent placement: `intents/emumet/features/ap-federation/overview.md` の残スコープ項目に対応。
  完了時に overview.md の「実装済みスコープ」へ移動し、`packets.md` に issue リンクを追記する
  (host-only タスク、backlog 運用メモ参照)。
- ADR candidate: none(既存の配送・権限パターンの踏襲であり、不可逆な新規決定なし)
- Diagram candidate: none
- Docs update: none(Emumet の外部向けユーザードキュメントは現状なし。docs 同期は
  ShuttlePub/document 側の別タスク)
- Closeout writeback expected: no

## Guide Reachability (G645)

While the author still knows the answer, name the guide surface and role that route to every
role-facing surface this slice adds, or explicitly say that no role-facing surface is added. A
blank answer is not treated as no-surface. The closeout record is a debt check, not a merge gate.

本スライスが追加する REST エンドポイントは API サーフェスであり、intent-cli guide の
role-facing surface ではない。`no_role_facing_surface: true` 相当(人間が guide 経由で
到達すべき運用画面・手順の追加なし)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
