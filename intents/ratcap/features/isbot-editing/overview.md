---
# Optional semantic facets (G529) — closed set, one line each:
#   vocabulary            — event/command vocabulary: what counts as a fact
#   invariant              — invariants and consistency boundaries
#   decider                — decider judgments: what a command decides
#   acceptance-property    — what must not break
# Uncomment and edit to annotate this node, e.g.:
# facets: [vocabulary]
---

# isbot-editing — overview

> **Ask intent-cli first:** `intent-cli guide intent-work setup --kind tree-layout --domain ratcap --format markdown`

## Goals

- アカウント**作成時**に `is_bot` フラグを設定できるようにする(2026-08-11 スコープ変更: 作成後の編集 UI は提供しない)。
- Emumet の `CreateAccountRequest` は `is_bot` を必須フィールドとして既に受け付けるため、BFF の `CreateAccountInput` に `isBot` を追加して正規にマッピングする。バックエンド変更不要。
- アカウント作成画面 (`AccountNew`) に bot フラグ用のチェックボックスを追加する。
- `spago bundle` および `bun scripts/sync-graphql.ts` による生成物更新までを含め、一連のビルド・テストが通る状態にする。

## Acceptance criteria summary

- `bff/schema.graphql` の `CreateAccountInput` に `isBot: Boolean` が追加される。
- `bff/resolvers.ts` の `createAccount` ミューテーションが `isBot` を `POST /api/v1/accounts` の `is_bot` フィールドへマッピングする(省略時は `false`)。
- `bun scripts/sync-graphql.ts` 実行後、`src/Generated/` 配下の PureScript 型に `isBot` が反映される。
- アカウント作成画面に「bot アカウント」チェックボックスが表示され、作成時に反映される。
- アカウント詳細の編集フォームには is_bot 変更 UI を追加しない(作成時のみ設定の方針)。
- `bun test`(BFF テスト)が成功する。
- `spago test`(PureScript テスト)が成功する。

## Related

- [requirements.md](requirements.md)
- [acceptance.md](acceptance.md)
- [decisions.md](decisions.md)
- [open-questions.md](open-questions.md)
- [packets.md](packets.md)
- [links.md](links.md)
