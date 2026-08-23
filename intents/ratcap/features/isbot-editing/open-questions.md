# isbot-editing — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) for domain-level open questions.

## Open questions blocking this feature

- なし(2026-08-24 grill で全件解消)。

## Resolved

- ~~Q1: `isBot` の初期値は `account` / `profile` のどちらの GraphQL 型から取得するか?~~
  **(2026-08-24 無効化)**: D6 のスコープ変更(作成時設定のみ・編集 UI 廃止)により
  編集時の初期値取得は不要になった。なお `Account` 型は `isBot: Boolean!` を
  既に公開しており、詳細画面のバッジ表示はこれを利用済み。
- ~~Q2: Emumet の `PATCH /api/v1/accounts/{id}` は `is_bot` を部分更新で受け付けるか?~~
  **(2026-08-24 無効化)**: 編集 UI を提供しないため PATCH 経路は使わない。
- ~~Q3: bot フラグ切り替え時にユーザーへの警告や確認ダイアログが必要か?~~
  **(2026-08-24 解決 / D7)**: 作成時チェックボックスに注意書き・確認ステップは
  追加しない(現状の裸のチェックボックスのまま)。ShuttlePub はサービス運営者向け
  管理 UI で利用者は bot フラグの意味を理解している層であり、誤設定時は
  Emumet API 直接で修正可能とする。
