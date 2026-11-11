# Technology Overview

## 現状スタック (2026-08-29 観察、base = d857781)

- **言語**: Rust (edition 2021)。ワークスペース構成で、クレートは
  kernel / application / driver / server の 4 つ。
- **アーキテクチャ**: クリーンアーキテク風の層分け。
  kernel (エンティティ・repository trait) → application (インタラクタ・
  adaptor trait・DTO) → driver (postgres 実装) → server (axum ルーティング
  + DI)。
- **Web フレームワーク**: axum 0.6。
- **DB アクセス**: sqlx 0.6 (postgres、native-tls runtime)。
- **DB**: PostgreSQL 15 (docker-compose で postgres:15.2-alpine)。
- **migration**: リポジトリ直下の `migrations/` (sqlx 形式のタイムスタンプ
  命名、現行は 20230216062352_init の 1 のみ)。
- **CI**: GitHub Actions、`ShuttlePub/workflows` リポジトリの
  reusable workflows (check / coverage) を利用。
- **ロギング**: tracing + tracing_subscriber (daily rolling file + stdout)。

## 宣言されているが未使用の依存 (観察)

driver の Cargo.toml に宣言があるが、コードベースから使用箇所が
見当たらない:

- deadpool-redis (redis コネクションプール)
- meilisearch-sdk (検索)
- lettre (メール送信)

kernel の `image` クレートも現時点では使用箇所なし。

## データモデル上の観察

- `accounts` テーブルは BIGSERIAL 主キー + name ユニーク + bot 旗のみ。
- `follows` は destination を local (FK) / remote (VARCHAR(512)) で
  分離した構造 (連合を意識した設計の名残)。
- `confidentials` テーブル (address + pass) があり、独自ローカル認証を
  想定した構造が残っている (サービス群の現行方針である Ory 委譲とは
  別系統)。
- notes 系テーブルは Rust 実装を持たず、かつ SQL 自体に未定義参照・
  構文上の問題を含む (適用可否は未検証)。

## 設計方向 (2026-08-29 grill 確定、decisions/2026-08-29-initial-shaping.md 参照)

- **Actor Model + Event Sourcing の採用** (D1): 2023 年スケルトンは全面刷新し、
  nitinol (Rust 製 ES toolkit、actor runtime 搭載) ベースで再構成する。
  stargate (edition 2024、app-cmd/driver/kernel/server) を構成の参考基盤とする。
- **リレーは本体に内蔵** (D2): stargate は PoC として位置づけ、AP 連携の
  実装知見を本体へ移管する。
- **イベント基盤の分離** (D8): 本体 (nitinol) と Emumet (独自 ES) の
  イベントストアは完全分離、連携は HTTP API のみ。
- **永続化** (D6): nitinol postgres アダプタ (別リポジトリ、実装中) 完了まで
  in-memory。アダプタ完成後に postgres へ切换 (将来 slice)。
- **ドメイン語彙** (D7): turbo / turbo_quote (ブースト / 引用の独自語) を維持。

## サービス群構成との対応

現行コードは Emumet / Ory / Booskiff を一切参照しない単体構成。
初動 (note-foundation) は Emumet 非依存で nitinol 基盤を検証し、capability
(post-relay / 署名 API) が Emumet 側で完成した後に API 接続する (D3/D4)。
その際の要求定義 (契約書) は note-foundation の受け入れ基準に含める (D10)。

## ShuttlePub Web frontend (F0, 2026-11-11)

`apps/shuttlepub-web` は PureScript + Flame の SSR/hydration アプリと Bun BFF で構成する。OpenAPI の正本・生成は ShuttlePub backend 側（S0）が所有し、frontends は producer commit SHA と checksum で固定した生成 OpenAPI を repo 内に取り込む。consumer 側では OpenAPI から TypeScript REST 型を生成し、型付き adapter からアプリ所有の GraphQL SDL に接続、SDL から PureScript 型を生成する。fixture は取り込んだ OpenAPI と照合し、生成物は手編集せず codegen の再現差分を CI で検査する。

mock / real は明示的に選択し、real の 501・失敗を mock へ暗黙 fallback しない。F0 のレイアウトは [quick-reaction-ui ui-spec v6](../features/quick-reaction-ui/ui-spec.md) に従い frontends PR #37（squash `83bd6a2e13c72b4c57363f3d97aab192c0ba6588`）で完了。基盤 PR #30（squash `05f679d9a329bd8c9de2782ad422cddf8e82d149`）は OpenAPI producer pin `4a30cafd691a415c8a651151085d1747e5326cca` を使用する。タイムライン／投稿 API は暫定 SDL で、real adapter は `NOT_IMPLEMENTED`。実 backend 接続済みとは扱わない。検証境界は offline build/mock、codegen 再現性、fixture schema 適合、SSR/hydration と mobile/desktop visual CI。
