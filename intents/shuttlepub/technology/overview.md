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

## サービス群構成との対応

現状コードは Emumet / Ory / Booskiff を一切参照しない単体構成。
サービス群の現行 intent (emumet/booskiff) が前提とする連携構成
(Emumet 経由の認証・代理署名、Booskiff 経由のメディア) はコード上
未実装。移行方針は未決定 (本ドメインの shaping 対象)。
