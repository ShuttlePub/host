# 決定: 生成 OpenAPI 契約の正本

- 状態: 確定
- 決定日: 2026-11-10
- 対象: `ShuttlePub/ShuttlePub` server API と、その consumer

## 背景

フロントエンドを backend の業務実装から独立して進めるため、
API 契約を ShuttlePub server 層に定義し、consumer が再現可能に取得できる必要がある。
配置先・生成方式の決定は
[優先度 interview q01–q03](../interviews/discord-feature-prioritization-2026-11-09.json)
に記録されている。

## 決定

1. 生成 OpenAPI `openapi/shuttlepub.json` を ShuttlePub API 契約の正本とする。
   `docs/openapi.json` は廃止し、生成 schema と並行する契約資料として維持しない。
2. `utoipa` と `utoipa-axum` を使い、`routes!` による単一の route 登録から
   Axum router と OpenAPI operation を構成する。route の定義を二重管理しない。
3. schema は決定的にレンダリングし、再生成後の差分を CI で検出する。
   生成物を手編集せず、意図的な契約変更は Rust の型・route 定義から行う。
4. `GET /openapi.json` は `openapi/shuttlepub.json` と同一の生成 schema を配信する。
5. 契約のみ定義した未実装 route は、共通の構造化エラー形式を使う明示的な
   `501 Not Implemented` stub とする。stub を成功応答として扱わない。
6. 既存の legacy development API（例: `/api/notes/...`）は生成 schema の対象外とする。
   consumer 向け契約の正本は `/api/v1/...` と生成 schema に限る。
7. consumer の frontends は schema を producer の commit SHA と checksum の両方で固定して
   取り込む。移動する branch 参照に依存せず、更新時は pin を明示的に変更する。
   初回 producer は PR #16 の squash commit
   `4a30cafd691a415c8a651151085d1747e5326cca`、その時点の
   `openapi/shuttlepub.json` の SHA-256 は
   `93bac49e5bec3b4385d668ba3bd89d1607c1371df025d2efed0f127a082bee1c`。

## 根拠

- interview:
  [discord-feature-prioritization-2026-11-09.json](../interviews/discord-feature-prioritization-2026-11-09.json)
  の `candidate-priority-q01-implementation-order`、
  `candidate-priority-q02-implementation-approach`、
  `candidate-priority-q03-openapi-definition-location`
- 実装・検証: [ShuttlePub/ShuttlePub PR #16](https://github.com/ShuttlePub/ShuttlePub/pull/16)、
  squash commit `4a30cafd691a415c8a651151085d1747e5326cca`

この決定は OpenAPI 契約基盤の確立を記録するものであり、個々の契約 route の
backend 業務実装や、それに依存する後続 unit の完了を意味しない。
