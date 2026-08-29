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
