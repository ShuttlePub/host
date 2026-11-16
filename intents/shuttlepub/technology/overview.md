# Technology Overview

## 現状スタック (2026-11-16、`dev` = f12933b)

`shuttlepub-layered-foundation` (ShuttlePub/ShuttlePub PR #31、Issue #30) で、
内部実装を土台から置き換えた (D15-D18)。`main` にはまだ入っていない。
実装リポジトリ側の説明は `docs/foundation.md`。

- **言語**: Rust (edition 2024、resolver 3)。クレートは kernel / application /
  driver / server の 4 つ。
- **層と依存方向** (D16): server → {application, driver} → kernel。
  - kernel: エンティティと値オブジェクト、外部接続の口 (trait)、`KernelError`。
    workspace 内の依存なし。tokio・axum・reqwest に依存せず、型を JSON の形として
    使わない (変換は server と driver が境界で行う)。
  - application: サービス、設定の口、`ApplicationError`。
  - driver: 口の実装 (リモート HTTP、HTTP 署名、メモリ上の署名鍵)、設定の読み込み、
    `DriverError`。
  - server: `Handler` / `AppModule`、axum の router とミドルウェア、HTTP ステータス
    への対応、`/api/v1` の契約、`main`。
- **DI (cake pattern)**: 口は `kernel::interface` の trait と `DependOn*` の対。
  サービスは supertrait で依存を宣言した trait (処理は default メソッド) +
  blanket impl + `DependOn*Service` で、struct を持たない。`Handler` が driver の
  実体を保持して全 `DependOn*` を実装し、axum の state は `AppModule(Arc<Handler>)`。
- **非同期の書き方**: 口の宣言は `-> impl Future<Output = ..> + Send`、実装は
  `async fn`、サービスの default メソッドは `impl Future + Send` を返す async ブロック
  1 つ。`async_trait` は使わない (`clippy::manual_async_fn` を CI で通すため、
  impl 側で Future を手書きしない)。
- **エラー**: 層ごとの `thiserror` enum を `error-stack` の `Report` で運ぶ。口は
  `KernelError` の分類で返し、HTTP ステータスへの対応は `server/src/error.rs` だけ。
- **連合**: `POST /inbox` (Follow の受理と Accept の配送) と `GET /actor` のみ。
  署名検証は inbox の POST ハンドラにだけ掛けたミドルウェアが口を呼ぶ。保存は
  何もしない (フォロワーの保存、再試行、重複排除は未実装)。
- **契約**: `/api/v1` は 15 操作すべて 501 のスタブ。`openapi/shuttlepub.json` は
  置き換えの前後でバイト一致 (D19)。
- **未導入**: nitinol 0.7 による CQRS+ES (D17) と永続化。旧 Note スライス
  (nitinol 0.4.2、インメモリ) と開発用ルート `/api/notes*`・`/api/timeline` は削除し、
  workspace に nitinol への依存はない。次の実行単位で入れる。
- **CI**: `.github/workflows/lint-and-test.yml` が `main` と `dev` への push・PR で
  fmt / clippy `-D warnings` / test / build / `git diff --check` / openapi-schema を実行。

### 置き換えで分かったこと (closeout)

- axum 0.8 の `Router::route_layer` は 405 を返す fallback にも layer を掛ける。
  ルートに掛けた署名検証ミドルウェアが POST 以外でも走り、401 を返してリモート
  取得まで進んだ。ミドルウェアは `post(handler).route_layer(..)` で POST ハンドラ
  だけに掛ける。
- 「署名を検証済みでなければ配送しない」は、server の `VerifiedFollow` 型だけが
  守っている。`AcceptFollowService::accept` 自体は未検証の入力も受け取れるので、
  呼び出し元を増やすときに検証の位置を見直す。
- kernel の署名検証の口は `http::Request<Bytes>` を受け取り、`ApplicationError` は
  `KernelError` と同じ分類の写しになっている。nitinol 導入時に見直す候補。
- 契約テスト (`server/tests/openapi.rs`・`quick_reaction.rs`) は、アプリの組み立て
  (`app()`) の差し替えと、削除した開発用ルートの検証 1 件の削除だけで維持できた。
  契約の定義は内部の crate を import していないため、内部実装と切り離せている。

## 旧スタック (2026-08-29 観察、base = d857781。履歴)

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
