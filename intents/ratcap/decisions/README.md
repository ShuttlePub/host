# decisions — ratcap ドメイン

ドメイン横断の設計判断を記録する場所。feature 個別の判断は各 feature 配下の `decisions.md` を参照。

## 既存のドメイン横断判断

- **BFF 経由のデータアクセス**: フロントエンドは Emumet REST API を直接呼ばず、BFF の GraphQL (`/graphql`) 経由とする。新機能追加時は `apps/emumet-web/bff/schema.graphql` の拡張が前提。
- **SDL が single source of truth**: スキーマ変更後は `apps/emumet-web` 配下で `bun scripts/sync-graphql.ts` を実行し、PureScript 型を再生成する。生成物はコミットする。
- **モノレポ再編 (2026-08-30)**: repo は `ShuttlePub/shuttlepub-frontends` に rename され、`apps/emumet-web` + `packages/` 構成となった。経緯・決定 (D1-D8) は [2026-08-30-monorepo-extraction.md](./2026-08-30-monorepo-extraction.md) 参照。本ドメインのドキュメントに登場する `bff/` / `src/` / `scripts/` パスは `apps/emumet-web/` 配下を指す。
