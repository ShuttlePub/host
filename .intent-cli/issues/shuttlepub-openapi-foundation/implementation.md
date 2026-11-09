# shuttlepub-openapi-foundation Implementation Packet

## Goal

ShuttlePub の server 層(Axum)へ utoipa を導入し、/api/v1 用の DTO・共通エラー形式・OpenAPI 生成基盤を整える。生成した schema を `openapi/shuttlepub.json` としてコミットし、`GET /openapi.json` で同一内容を配信し、再生成差分を CI で検出する。以降の契約ユニット(quick-reaction-api-contract 等)と frontends の SNS UI が依拠する、生成 schema を正本とする契約の土台を作る。

## Why

ShuttlePub backend の本実装には時間がかかる可能性があるため、UI を先行させる方針が採られた。UI 先行には、backend 実装と独立に frontends が取り込める API 契約が要る。API 定義の配置先と形式は「ShuttlePub/ShuttlePub の server 層で WebAPI 定義だけを実装し utoipa 等で OpenAPI を生成する」と決定済みで、本ユニットがその基盤であり、S3(quick-reaction-api-contract)と frontends 側 F0(shuttlepub-web-foundation)の前提になる。

## Scope

- server crate への utoipa(必要なら axum 統合・schema 出力用の補助 crate)導入と Cargo.lock 更新(`--locked` CI が通ること)
- /api/v1 名前空間の方針と共通 DTO・共通エラー形式(エラーコード・メッセージ・詳細の schema)の定義
- OpenAPI ドキュメント集約(info・version・components)と、route を追加すると schema と router の双方へ 1 箇所の定義から反映される配線
- `openapi/shuttlepub.json` を決定的に出力する再生成手段(例: 専用 bin / xtask / テスト。キー順・整形・末尾改行を固定)
- `GET /openapi.json` での生成 schema 配信(`openapi/shuttlepub.json` と同一内容)
- 再生成して差分があれば失敗する CI ステップの追加(既存 lint-and-test.yml へ)
- route / schema snapshot テストと、501 契約 stub が共通エラー形式を返すことを確認するテスト(検証用 route が必要なら本番 schema へ業務 endpoint を先取りせず、テスト内で定義する)

## Out of scope

- 本格 backend・DB・認証・連合処理の実装
- 旧 docs/openapi.json との互換・移行・同期(同ファイルは廃止予定。触らなくてよい)
- 既存 dev API(/api/notes 等)を生成 schema へ載せること
- quick reaction 等の業務 endpoint 契約(別ユニット quick-reaction-api-contract 等で定義)
- frontends 側の schema 取込・型生成

## Design notes

- 決定性: schema 出力はキー順・インデント・末尾改行を固定し、HashMap 由来の順序揺れを排除する
- 配信 `/openapi.json` と `openapi/shuttlepub.json` は同一の生成関数から得る(二重管理しない)
- 契約 route 未実装の 501 は共通エラー形式に統一し、schema の responses にも記述する

## Verification

- 既存 Rust CI(cargo fmt --all -- --check、cargo clippy --workspace --all-targets --all-features --locked -- -D warnings、cargo test --workspace --all-features --locked、cargo build --workspace --locked、git diff --check)がグリーン
- schema 再生成を 2 回実行して byte 一致し、コミット済み `openapi/shuttlepub.json` と差分がない。CI の再生成差分チェックが意図的な差分で失敗することを確認する
- `GET /openapi.json` の応答本文が `openapi/shuttlepub.json` と一致するテスト
- route / schema snapshot テスト(/api/v1 名前空間・共通エラー schema・既存 dev API が schema に載らないこと)
- 501 契約 stub が共通エラー形式で明示的に失敗し、成功応答を返さないテスト

## Knowledge Maintenance (G461)

- Intent placement: intents/shuttlepub/product/social-experience.md と intents/shuttlepub/packets/candidates.md の D03 節・共通の分割方針へ S0 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: yes — intents/shuttlepub/decisions/generated-openapi-contract.md(生成 schema を契約の正本とする決定)。host 側 closeout で作成する(実装 repo は編集しない)
- Diagram candidate: none
- Docs update: 契約の正本・再生成手順・検証境界を social-experience.md / technology/overview.md に記録
- Closeout writeback expected: yes
