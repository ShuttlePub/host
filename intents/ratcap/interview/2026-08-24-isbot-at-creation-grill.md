# Interview: isbot-at-creation grill (2026-08-24)

chat-first grill セッションで記録。CLI セッション記録:
`intents/ratcap/interviews/isbot-at-creation.json` (Q1)。

契機: ratcap backlog Ready 先頭だった `isbot-at-creation` の grill。
調査の結果、実装が backlog 起票 (2026-08-11) 以前の初期 BFF コミット群
(RatCap `79b745f` / `4b60abe`) に含まれており、issue 未発行のまま完了済みと判明。
open-questions Q1/Q2 は D6 のスコープ変更(作成時設定のみ・編集 UI 廃止)で無効化済みと確認。

## 実装済みの検証 (2026-08-24)

- `bff/schema.graphql`: `CreateAccountInput.isBot: Boolean` / `Account.isBot: Boolean!`
- `bff/emumet/real.ts`: `is_bot: input.isBot ?? false` で Emumet へ送信
- `bff/emumet/mock.ts`: mock でも保存・読み出し対応
- `src/Generated/`: 生成型に isBot 反映済み
- `src/App/View/AccountNew.purs`: 作成フォームにチェックボックス (`SetNewAccountIsBot`)
- `src/App/View/AccountDetail.purs`: isBot バッジ表示のみ、編集 UI なし (AC8 適合)
- `bun test`: 51/51 pass
- `spago test`: ビルド成功 (PureScript テストスイートは現状空)

## Q1: 作成フォームの bot チェックボックスに注意書き・確認ステップを追加すべきか?

**Answer**: A. 現状のまま(裸のチェックボックス)。注意書き・確認ダイアログは追加しない。
ShuttlePub はサービス運営者向け管理 UI で、利用者は bot フラグの意味を理解している層のため。
誤設定時は Emumet API 直接叩きで修正可能とする。

→ D7 として decisions.md に記録。UI 受入の最終形が確定し、packet は完了記録された。

## 後処理 (intent-update)

- `packets/backlog.md`: `isbot-at-creation` を完了セクションへ移動
- `features/isbot-editing/requirements.md`: D6 スコープ(作成時のみ)へ全面改訂
  (旧版は編集 UI 前提で stale だった)
- `features/isbot-editing/open-questions.md`: Q1/Q2 無効化・Q3 解決として全件クローズ
- `features/isbot-editing/acceptance.md`: AC1-AC10 を検証済みでチェック。
  AC11 (手動 smoke) は次回 UI 変更時に併せて実施の方針
- `intent-tree/00-map.md`: 現状カバレッジ更新 (isbot-editing を不足一覧から完了へ)
