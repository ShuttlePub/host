## Goal

ADR 0006 Stage 8 (最終 stage)。adapter クレートを解体・削除し、route 層に
facade newtype を導入して生 port / executor へのアクセスをコンパイル時に遮断する。
AppModule/Handler の二重委譲 (~296行) は配線専用1型 + 拡張
`impl_database_delegation!` に集約する。

## Why This Slice Exists Now

Stage 4/7 で Account/Profile/Metadata の書き込みは AggregateRepository 経由に、
投影は tailing projector に移行済み。adapter の processor は「CommandEnvelope を
組み立てて repository を呼ぶだけ」の薄い調停層に退化しており、ADR 決定1
(adapter 解体)・決定7 (facade による型レベル遮断 + 委譲集約) を完了させる
条件が揃った。これが ADR 0006 の最終実施ユニット。

## Current Observed State

- adapter crate (8ファイル・880行) の残存物は processor (account command/query,
  profile, metadata) と crypto (SigningKeyGenerator) のみ。全て blanket impl ベースの
  調停 trait。参照元は application 18ファイル + server 3ファイル (計21)、
  driver からの参照ゼロ
- AccountQueryProcessor は18ファイルから参照 (application 15 + server 3:
  route/activitypub/mod.rs, route/signing.rs, route/account/follow_relations.rs
  のテスト)。command 系は account/create.rs, account/update.rs,
  account_detail/{update,fields}.rs の計4ファイル
- server/src/handler.rs: `AppModule { handler: Arc<Handler> }` の二重構造。
  AppModule に手書き委譲 impl が34ブロック (L43-338, 約296行)、うち22個は
  `kernel::impl_database_delegation!` が Handler に生成するものと完全重複。
  マクロ非対象は DependOnAccountEventLog / DependOnProjectionCheckpointStore /
  DependOnAccountProjectionWriter / DependOnBlockRepository /
  DependOnMuteRepository の DB 系5個と、非 DB (crypto / permission /
  http_signing / config) の7個
- 全34ルートハンドラが素の `State<AppModule>` を受ける (facade 型は未存在)。
  ルート層の生アクセス: 生 executor (activitypub/mod.rs:67-71,
  signing.rs:86-90,158-162)、adapter processor 直接使用 (activitypub/mod.rs:74,
  signing.rs:92,164)、生 Ory クライアント (oauth2/login.rs:30-31,
  consent.rs:53,133)、DependOnPublicBaseUrl (discovery.rs, inbox.rs)、
  DependOnHttpSignatureVerifier (inbox.rs)
- rename 残件: `application::transfer` モジュール (→ dto)、
  `kernel::signal::Signal` trait (参照ゼロの孤児)

## Accepted Baseline You May Assume

- Account/Profile/Metadata の書き込みは `AggregateRepository<A>` 経由で確定済み
  (Stage 4/7)。adapter の command processor は CommandEnvelope 構築の調停のみ
- 投影は tailing projector (Account/Profile/Metadata) に一本化済み。
  Redis applier 経路は全削除済み
- `impl_database_delegation!` (kernel/src/lib.rs:92-249) は22 trait を生成し、
  handler.rs + projection tests ×3 + characterization tests の TestModule で
  使用されている
- ルート別の UseCase 使用状況・生アクセス箇所は implementation packet
  (host repo `.intent-cli/issues/di-cleanup-adapter-removal/`) の
  technical_baseline に file:line で列挙済み
- `Executor`→`Connection`、`transaction`→`conn`、server Applier→Projector の
  rename は完了済み。`Nanoid`→`PublicId` は外部 API 互換のため本 Stage でも
  実施しない

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `adapter/, kernel/src/lib.rs, kernel/src/interfaces/, kernel/src/signal.rs, kernel/src/read_model/, kernel/src/repository/, application/src/lib.rs, application/src/transfer/, application/src/service/, application/src/signing_key.rs, server/src/handler.rs, server/src/route/, server/src/api/ (新設), server/src/main.rs, server/Cargo.toml, application/Cargo.toml, Cargo.toml`

Target part: adapter の processor / crypto を kernel / application に解体吸収し、route に facade newtype を導入して生 port / executor アクセスをコンパイル時に遮断、AppModule/Handler の二重委譲を配線専用1型に集約し、adapter クレートを削除する

## In Scope

- 先行する純粋 rename commit: `application::transfer` → `application::dto`、
  参照ゼロの `kernel::signal::Signal` trait 削除
- query processor 解体: `AccountQuery` / `ProfileQuery` / `MetadataQuery` trait を
  kernel に定義 (read model facade、決定3の `*Query` 系統) し、現行
  `*QueryProcessor` と同じメソッド集合を `DependOn*ReadModel` への blanket impl
  で提供。全呼び出し側 (application 15 + server 3) を置換
- command processor 解体: account/create.rs, account/update.rs,
  account_detail/update.rs, account_detail/fields.rs が `AggregateRepository<A>`
  を直接使用。CommandEnvelope 構築 + 同期 read model 書込みの調停は use case に
  移管。Param 型 (6つ) は kernel または application に移動
- crypto 解体: `SigningKeyGenerator` / `DependOnSigningKeyGenerator` を
  kernel::interfaces::crypto に移動
- adapter クレート削除: server/application の Cargo.toml から依存除去、
  workspace members から除外、adapter/ ディレクトリ削除
- route facade newtype: `server/src/api/` に領域別 facade (AccountApi /
  AdminAccountApi / MeApi / OAuth2Api / ActivityPubApi / SigningApi 相当)。
  facade は DependOn* を実装せず、use case メソッドと正当な補助操作
  (resolve_auth_account_id, find_account_id_by_nanoid, check_permission,
  public_base_url, http signature verify, hydra/kratos アクセス) のみ公開
- DI 委譲集約: AppModule/Handler を配線専用1型に統合 (決定10 の server Handler
  改名を含む)。`impl_database_delegation!` に DependOnAccountEventLog /
  DependOnProjectionCheckpointStore / DependOnAccountProjectionWriter /
  DependOnBlockRepository / DependOnMuteRepository を追加。手書き委譲を撤去

## Out Of Scope

- `Nanoid` → `PublicId` rename (外部 API パス互換の検討が必要。別ユニット)
- status / media / timeline / notification 系の ES 化 (ADR 0006 の対象外)
- 決定5 (Keto) の変更
- ルートテスト内のテスト用配線からの生アクセス (テスト用モジュール経由は許容)

## Standalone Child Issue Contract

This issue asks the child implementation repo to complete ADR 0006: dissolve the
adapter crate by moving its query processors to kernel `*Query` facade traits
(blanket-implemented over `DependOn*ReadModel`), inlining command-processor
mediation into the use cases that call `AggregateRepository<A>` directly, and moving
`SigningKeyGenerator` into kernel; then delete the adapter crate from the workspace.
Introduce per-area facade newtypes under `server/src/api/` so that route handlers
depend only on use-case methods (facades must not implement `DependOn*`, making raw
port/executor access a compile error), absorbing the shared helpers
(`resolve_auth_account_id`, `find_account_id_by_nanoid`, `check_permission`,
Ory client access) into the facades. Consolidate the AppModule/Handler double
delegation into a single wiring-only type backed by an extended
`impl_database_delegation!` macro (adding the five hand-written DB traits), removing
the ~296 lines of handwritten delegation. A leading pure-rename commit renames
`application::transfer` to `application::dto` and deletes the orphaned
`kernel::signal::Signal` trait. Tests must stay green and `main` must remain green.

## Acceptance Criteria

- 先行 rename commit が純粋 rename として分離されている (transfer→dto, Signal 削除)
- `AccountQuery` / `ProfileQuery` / `MetadataQuery` が kernel に定義され、
  全呼び出し側が `*QueryProcessor` から置き換わっている
- command 呼び出し側4ファイルが `AggregateRepository<A>` 直接呼び出しになり、
  同期 read model 書込みの順序が維持されている (Stage 7 教訓: 落とすと
  read-after-write が race する)
- adapter クレートが削除され、`cargo tree` / `cargo metadata` に残らない
- ルートハンドラが facade 経由のみで依存を取得し、route/ 以下から
  kernel DependOn* / adapter / `database_connection().connection()` の
  直接 import が消えている (テスト用配線を除く)
- facade 型が DependOn* を実装しておらず、route から生 port 到達が
  コンパイルエラーになる
- AppModule/Handler が配線専用1型に統合され、手書き委譲 ~296行が撤去されている
- HTTP/OpenAPI 表面が不変 (utoipa 定義に影響なし)
- cargo test (DATABASE_URL あり) / clippy / fmt green。e2e (compose) green。
  characterization tests も green

## Verification

- Equivalence: e2e (compose) が全シナリオ green。HTTP レスポンス形状の変更なし
- Grep: `adapter::` への参照がワークスペースに残らない。
  `*CommandProcessor` / `*QueryProcessor` への参照が残らない。route/ 以下に
  `DependOn` / `database_connection` の import が残らない (テスト除く)
- 型レベル遮断の確認: facade が DependOn* を実装していないこと
  (route から `facade.database_connection()` 等を呼ぶコードが
  コンパイルエラーになること)
- `git diff --check` clean。rename commit が挙動変更を含まないこと
  (commit 単位で diff を確認)

## Related Links

- ADR 0006: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
  (決定1 / 決定7 / 決定10)
- Backlog: `intents/emumet/packets/backlog.md`
- Stage 4 PR #31: https://github.com/ShuttlePub/Emumet/pull/31
- Stage 6 PR #35: https://github.com/ShuttlePub/Emumet/pull/35
- Stage 7 PR #38: https://github.com/ShuttlePub/Emumet/pull/38

## Knowledge Maintenance

- Intent placement: `intents/emumet/decisions/0006-architecture-realignment-transaction-projection.md`
- ADR candidate: yes — record Stage 8 final values (facade inventory and public
  surfaces, wiring-only type name, macro extension, `*Query` placement, Param type
  destinations, rename results) in ADR 0006 decisions 7/10.
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes

## Guide Reachability

No role-facing surface is added. HTTP routes and response shapes remain unchanged;
this slice changes internal DI/wiring/crate structure only.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
