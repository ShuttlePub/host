## Goal

ShuttlePub の server 層(Axum)へ utoipa を導入し、/api/v1 用の DTO・共通エラー形式・OpenAPI 生成基盤を整える。生成した schema を `openapi/shuttlepub.json` としてコミットし、`GET /openapi.json` で同一内容を配信し、再生成差分を CI で検出する。以降の契約ユニット(quick-reaction-api-contract 等)と frontends の SNS UI が依拠する、生成 schema を正本とする契約の土台を作る。

## Why This Slice Exists Now

ShuttlePub backend の本実装には時間がかかる可能性があるため、UI を先行させる方針が採られた。UI 先行には、backend 実装と独立に frontends が取り込める API 契約が要る。API 定義の配置先と形式は「ShuttlePub/ShuttlePub の server 層で WebAPI 定義だけを実装し utoipa 等で OpenAPI を生成する」と決定済みで、本ユニットがその基盤であり、S3(quick-reaction-api-contract)と frontends 側 F0(shuttlepub-web-foundation)の前提になる。

## Current Observed State

- ShuttlePub main(7eea43d 時点): workspace は kernel / application / driver / server。server/src/lib.rs の Axum router は /api/notes、/api/notes/{id}/reactions、/api/timeline、/inbox、/actor 等の開発用 route を持つ
- utoipa は未導入。docs/openapi.json は手書きの開発 API 記述(廃止予定)
- CI は .github/workflows/lint-and-test.yml(cargo fmt --check、clippy --all-targets -D warnings、test、build、git diff --check)。workspace lints は unwrap_used / expect_used / todo を deny
- /api/v1 の名前空間、共通エラー形式、生成 schema は存在しない

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は ShuttlePub/ShuttlePub の server 層(Axum)に utoipa 等で実装し、そこから OpenAPI schema を生成する。ハンドラーの本実装はこの段階では行わない。frontends の SNS UI はこの生成 schema を使う。旧 docs/openapi.json は廃止予定で互換を考慮しない
- 契約 route は本実装を持たず、明示的な 501(共通エラー形式)で未実装を示す。成功を装う応答、todo!/unimplemented!、panic による代替は使わない
- 生成 schema(`openapi/shuttlepub.json`)が契約の正本。手書きで編集せず、生成コマンドで更新する
- 既存の開発 API(/api/notes 等)は legacy development API として維持し、生成 schema には載せない
- 認証・DB・連合処理の本格実装は別ユニット。本ユニットは契約基盤のみ

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `server/`, `openapi/shuttlepub.json`, `Cargo.toml`, `Cargo.lock`, `.github/workflows/lint-and-test.yml`

Target part: "ShuttlePub server 層(Axum)の OpenAPI(utoipa)生成基盤、/api/v1 共通 DTO・エラー形式、/openapi.json 配信、再生成差分 CI"

## In Scope

- server crate への utoipa(必要なら axum 統合・schema 出力用の補助 crate)導入と Cargo.lock 更新(`--locked` CI が通ること)
- /api/v1 名前空間の方針と共通 DTO・共通エラー形式(エラーコード・メッセージ・詳細の schema)の定義
- OpenAPI ドキュメント集約(info・version・components)と、route を追加すると schema と router の双方へ 1 箇所の定義から反映される配線
- `openapi/shuttlepub.json` を決定的に出力する再生成手段(例: 専用 bin / xtask / テスト。キー順・整形・末尾改行を固定)
- `GET /openapi.json` での生成 schema 配信(`openapi/shuttlepub.json` と同一内容)
- 再生成して差分があれば失敗する CI ステップの追加(既存 lint-and-test.yml へ)
- route / schema snapshot テストと、501 契約 stub が共通エラー形式を返すことを確認するテスト(検証用 route が必要なら本番 schema へ業務 endpoint を先取りせず、テスト内で定義する)

## Out Of Scope

- 本格 backend・DB・認証・連合処理の実装
- 旧 docs/openapi.json との互換・移行・同期(同ファイルは廃止予定。触らなくてよい)
- 既存 dev API(/api/notes 等)を生成 schema へ載せること
- quick reaction 等の業務 endpoint 契約(別ユニット quick-reaction-api-contract 等で定義)
- frontends 側の schema 取込・型生成

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の server 層に utoipa による OpenAPI 生成基盤を導入し、/api/v1 用の共通 DTO・エラー形式、決定的に再生成される `openapi/shuttlepub.json`、同一内容を返す `GET /openapi.json`、再生成差分を検出する CI を追加すること。契約 route の未実装部分は明示的な 501 で、架空の成功や todo!/unimplemented! を使わない。既存 Rust CI がグリーンであること。

## Acceptance Criteria

- utoipa 由来の生成 schema が `openapi/shuttlepub.json` としてコミットされ、`GET /openapi.json` の配信内容と一致する
- 契約 route の未実装部分は共通エラー形式の明示的 501 を返し、架空の成功応答や todo!/unimplemented! を使わない
- schema は決定的に再生成され(同一入力で byte 一致)、コミット済み schema との差分を CI が検出して失敗する
- /api/v1 用の DTO と共通エラー形式が定義され、schema に components として出力される
- 既存 dev API(/api/notes 等)の挙動と既存テストを壊さない。既存 Rust CI(fmt / clippy -D warnings / test / build / git diff --check)がグリーン

## Verification

- 既存 Rust CI(cargo fmt --all -- --check、cargo clippy --workspace --all-targets --all-features --locked -- -D warnings、cargo test --workspace --all-features --locked、cargo build --workspace --locked、git diff --check)がグリーン
- schema 再生成を 2 回実行して byte 一致し、コミット済み `openapi/shuttlepub.json` と差分がない。CI の再生成差分チェックが意図的な差分で失敗することを確認する
- `GET /openapi.json` の応答本文が `openapi/shuttlepub.json` と一致するテスト
- route / schema snapshot テスト(/api/v1 名前空間・共通エラー schema・既存 dev API が schema に載らないこと)
- 501 契約 stub が共通エラー形式で明示的に失敗し、成功応答を返さないテスト

## Related Links

- 後続ユニット: quick-reaction-api-contract(ShuttlePub/ShuttlePub、本ユニットに依存)、shuttlepub-web-foundation(ShuttlePub/shuttlepub-frontends、本ユニットの生成 schema を取り込む)
- 意図: intents/shuttlepub/product/social-experience.md (I03)、intents/shuttlepub/packets/candidates.md (D03・共通の分割方針)
- 決定記録: intents/shuttlepub/interviews/discord-feature-prioritization-2026-11-09.json (candidate-priority-q01〜q03)

## Knowledge Maintenance

- Intent placement: intents/shuttlepub/product/social-experience.md と intents/shuttlepub/packets/candidates.md の D03 節・共通の分割方針へ S0 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: yes — intents/shuttlepub/decisions/generated-openapi-contract.md(生成 schema を契約の正本とする決定)。host 側 closeout で作成する(実装 repo は編集しない)
- Diagram candidate: none
- Docs update: 契約の正本・再生成手順・検証境界を social-experience.md / technology/overview.md に記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`, `Cargo.toml`, `Cargo.lock`, `.github/workflows/lint-and-test.yml`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
