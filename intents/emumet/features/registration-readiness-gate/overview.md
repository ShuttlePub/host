---
facets: [vocabulary, invariant]
---

# registration-readiness-gate — overview

## Goals

メール認証または CAPTCHA 等の BOT 対策の準備が整わないまま、新規登録を一般開放して
スパム BOT の踏み台になることを防ぐ。Ory Kratos の self-service registration（新しい
Ory identity の作成）に対する「登録ゲート」を Emumet が管理者向けの制御面として持つ。

- 意図の出典: [I15](../../../shuttlepub/product/social-experience.md#i15) /
  [D15 candidate](../../../shuttlepub/packets/candidates.md#d15)
- ユーザー決定の正本:
  [grill 記録](../../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json)の
  `d15-q01`〜`d15-q11`
- 計画（execution unit 分割）の正本: [packets.md](packets.md)。契約・検証境界: [acceptance.md](acceptance.md)

## 確定済みのユーザー決定（要約。詳細は grill 記録が正本）

| 決定 | 内容 |
|---|---|
| q01 | 最低条件は「メール認証 OR BOT 対策」。どちらか一方でよく、両方は必須ではない |
| q02 | 一般開放後の設定変更で両方が無効になったら、新しい一般登録を自動停止（既存利用者のログイン・利用は対象外） |
| q03 | 設定喪失で停止した後は、復旧しても自動再開せず管理者の手動再開が必要。再開時も最低条件を満たさなければ開放不可。手動閉鎖を自動解除しない |
| q04 | 特定相手への招待登録には最低条件を要求しない（招待機能の新設や公開無制限リンクによる迂回を許す決定ではない） |
| q05 | 設定が有効なだけでは準備済みとせず、検証 API の実応答を確認して初めて準備済み |
| q06 | 設定を失わない一時的な外部障害で最低条件を満たす対策が残らない間は、一般登録のみ一時拒否。通知し、復旧後は手動再開なしで自動再開 |
| q07 | 両対策を用意して片方だけ障害なら、動作中の対策のみを課して継続。防御低下を通知 |
| q08 | ゲートは Ory self-service registration のみが対象。ログイン済み利用者の `POST /api/v1/accounts` は対象外 |
| q09 | 無対策でも、管理者が警告を明示確認すれば一般開放できる override を認める |
| q10 | override は管理者が明示解除するまで有効。上書き中は通常の自動停止・障害時拒否判定を行わず、管理画面に常時表示 |
| q11 | 通知は管理画面内の通知一覧＋未読表示、および外部 Webhook を初回から含める。メール通知は前提にしない |

## 状態の考え方（E15a が契約化する）

- 通常ゲート: 管理者の開閉状態 × 設定上の有効対策 × 検証 API の健全性から「受付可／一時拒否／停止ラッチ」を導く。
  - 一時拒否（q06）は障害復旧で自動解除される。
  - 停止ラッチ（q02/q03）は設定喪失で成立し、管理者の手動再開でのみ解除される。
- override（q09/q10）は通常判定と排他的で、明示解除まで継続する。
- 状態遷移と通知イベントは同一 transaction で永続化する。probe の反復では通知を増殖させない。
- 管理者別の既読状態を持つ（管理者間で共有しない）。

## Non-goals

- 新しい招待システムの新設、login の遮断、`POST /api/v1/accounts`（追加 Account 作成）へのゲート適用
- 特定 CAPTCHA 提供者の決定、OAuth による代替条件、セルフホスト全般の条件解除
- メール通知、汎用 integration 基盤
- Account 数上限等の濫用対策（別論点）

## 正本の所在

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に
child へ親状態を作成しない。D15 全体は実 Kratos 経路で守れて初めて完了で、unit の queue 登録・完了を
D15 全体の ready／完了とは扱わない。
