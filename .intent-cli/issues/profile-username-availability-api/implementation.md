# profile-username-availability-api Implementation Packet

> **親状態の注記**: durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

認証必須の Profile username 空き確認 API `GET /api/v1/profiles/username-availability?username=...` を追加する。形式不正・予約語・使用中/削除済み (再利用不可) を判定し、`{ username, available, reason? }` を返す。読取専用でレート制限付き。

## Why

FN (shuttlepub-frontends#34、emumet-web) の入力中検証で、形式・予約語に加えて重複も判定できるようにする。現状は重複が送信時の 409 でしか分からない。計画外の追加 unit (ユーザー承認 question-66c258dd659b42f5ed0c13ae2c29fdf5)。

## Scope

- `ProfileEventStore` に username の存在確認 (読取専用) を追加し、`PostgresProfileEventStore` が `profile_events` の `data ->> 'username'` を引く (部分 unique index `profile_events_username_unique` と同じ判定源)
- application に `profile_username_availability.rs` (新規) のユースケース。形式・予約語は `ProfileUsername::check` を流用、DB は形式 OK の場合だけ引く
- server に facade・route・schema (すべて新規) と、(iss, sub) 単位の in-process スライディングウィンドウ制限 (既定 60 回/分、超過 429 + `Retry-After`)
- 応答 reason: `invalid_format` / `reserved` / `taken` (使用中と削除済みは区別しない)
- `root_router.rs` に mount、`openapi.rs` に登録、`openapi.json` 再生成。共有ファイルは数行の追加のみ
- 実 DB の route test と limiter の単体テスト

## Out of scope

- username の変更、予約 (ホールド) 機能
- 新しい DB migration・DependOn・AppModule 変更
- P4 (PR #91) と重複する変更・無関係なリファクタ

## Verification

- `DATABASE_URL` を設定した実 DB の route test (skip のみ不可)
- `cargo test -p server write_openapi_spec_to_file -- --ignored` で再生成し `git diff --exit-code openapi.json`、`openapi_spec_matches_committed_file`
- `cargo fmt --check`、`cargo clippy`、`cargo test`、`git diff --check`

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/profile-federation/overview.md` (primary)
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: なし
- Closeout learning: path・応答形・reason 種別・制限方式と値・判定源の確定形を PF packets.md / acceptance.md へ書き戻す (`write_back_required: true`、host 更新は親が行う)
- Guide reachability (G645): implementation-loop ガイド → implementation ロール → REST 読取 endpoint (`GET /api/v1/profiles/username-availability`、`openapi.json`)
