# ratcap — packet backlog (2026-08-11)

集約 host (ShuttlePub/host) への移行後の順序付き backlog。
Emumet は ShuttlePub サービスのアカウント管理機能を提供する定位であり、Ratcap はその管理 UI
として「バックエンド実装済み・フロント未実装」の機能を埋めていく。packet 実体は
`.intent-cli/issues/<unit>/`。

## Ready(切り出し可能)

| # | execution unit | feature | 概要 | 依存 |
|---|---|---|---|---|
| 1 | `block-mute-management` | [block-mute](../features/block-mute/overview.md) | blocks/mutes 一覧 + 解除(追加 UI なし) | — |
| 2 | `account-deactivation` | [account-deactivation](../features/account-deactivation/overview.md) | アカウント削除 + 確認ダイアログ | — |
| 3 | `follow-management` | [follow](../features/follow/overview.md) | following/followers 一覧 + unfollow(フォローフォームなし) | — (ブロッカーだった Emumet `unfollow-api` は PR #21 で 2026-08-12 マージ済み、2026-08-24 に Blocked 解除) |
| 4 | `admin-moderation` | [admin-moderation](../features/admin-moderation/overview.md) | 停止/BAN UI + 通報キュー UI (/admin 集約) + 未対応件数バッジ。設計確定 (2026-08-23 横断 grill、decisions.md 参照) | — (publish 条件だった Emumet `moderation-account-report` は PR #54 で 2026-08-23 マージ済み、2026-08-24 に Ready 化) |

## 完了

- `oauth2-consent-flow` — issue #6 / PR #7 マージ済み(2026-08-24、merge commit
  `1676769`)。BFF `index.ts` に `GET/POST /oauth2/consent` を追加 (real モードのみ登録):
  Emumet ShowConsent 呼出 → 同意フォーム standalone HTML 描画 / auto-skip 時 302 伝搬、
  許可・拒否の中継 → 302。i18n スコープラベル (ja プライマリ + en、Accept-Language q 値
  判定、未知スコープ生名フォールバック)、ratcap_session 不要 (challenge ベース)、
  CSRF Origin/Referer 検証、HTML エスケープ、上游エラーの非露出。bun test 85 pass
  (既存 51 + 新規 34)。D6 成果物 `deploy/hydra-consent-url.patch` を同梱し、
  Emumet `ory/hydra/hydra.yml` へ適用済み (ローカル deploy 設定として未コミット。
  Hydra 未起動のため次回起動時に有効化)。手動 E2E は未実施 (real モード環境依存、
  PR 本文に明記)
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
