# ratcap — packet backlog (2026-08-11)

集約 host (ShuttlePub/host) への移行後の順序付き backlog。
Emumet は ShuttlePub サービスのアカウント管理機能を提供する定位であり、Ratcap はその管理 UI
として「バックエンド実装済み・フロント未実装」の機能を埋めていく。packet 実体は
`.intent-cli/issues/<unit>/`。

## Ready(切り出し可能)

| # | execution unit | feature | 概要 | 依存 |
|---|---|---|---|---|
| 1 | `oauth2-consent-flow` | [oauth2-consent](../features/oauth2-consent/overview.md) | 外部 ShuttlePub ホスト(サードパーティクライアント)向けの明示同意画面 | — |
| 2 | `block-mute-management` | [block-mute](../features/block-mute/overview.md) | blocks/mutes 一覧 + 解除(追加 UI なし) | — |
| 3 | `account-deactivation` | [account-deactivation](../features/account-deactivation/overview.md) | アカウント削除 + 確認ダイアログ | — |

## Blocked(Emumet 側 packet 待ち)

| # | execution unit | feature | 概要 | ブロッカー |
|---|---|---|---|---|
| 4 | `follow-management` | [follow](../features/follow/overview.md) | following/followers 一覧 + unfollow(フォローフォームなし) | Emumet `unfollow-api`(`intents/emumet/packets/backlog.md`) |

## 後続(設計待ち)

| # | execution unit | feature | 概要 | 依存 |
|---|---|---|---|---|
| 5 | `admin-moderation` | [admin-moderation](../features/admin-moderation/overview.md) | 停止/BAN UI + 通報キュー UI (/admin 集約) + 未対応件数バッジ。設計確定 (2026-08-23 横断 grill、decisions.md 参照) | Emumet `moderation-account-report` マージ後に publish (直列) |

## 完了

- `isbot-at-creation` — 2026-08-24 grill で実装済みを確認し完了記録。issue 未発行のまま
  初期 BFF コミット群(RatCap `79b745f` / `4b60abe`)に実装が含まれており、backlog 起票
  (2026-08-11) 以前から main に存在。AC1-AC10 検証済み (bun test 51/51、spago ビルド成功)。
  UI 受入最終形は grill Q1 / D7 (注意書きなしの裸チェックボックス)。
  詳細: [../features/isbot-editing/packets.md](../features/isbot-editing/packets.md) ・
  [../interview/2026-08-24-isbot-at-creation-grill.md](../interview/2026-08-24-isbot-at-creation-grill.md)

## 運用メモ

- 一度に publish するのは先頭 1 件のみ(stack のデフォルト境界)。
- 各 packet 完了時に対応する features/*/packets.md へ issue リンクを追記する。
- settings-hub は完了済み(旧セットアップの ShuttlePub/RatCap#3)。
