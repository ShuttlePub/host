# Intent Map

- Domain: `ratcap`
- Target repo: `ShuttlePub/shuttlepub-frontends` (旧 `ShuttlePub/RatCap`、2026-08-30 rename)
- Upstream backend: [`ShuttlePub/Emumet`](https://github.com/ShuttlePub/Emumet) (Rust ActivityPub サーバー)

## ドメインの形

Ratcap は Emumet の Web フロントエンド。PureScript + Flame (Elm アーキテクチャ) による SSR + クライアントハイドレーション構成で、BFF (`bff/`, graphql-yoga) 経由で Emumet REST API を利用する。

```
[Browser] ←SSR/hydration→ [Ratcap (PureScript/Flame)]
                              ↓ GraphQL /graphql + REST /auth/*
                          [BFF (bff/)]
                              ↓ REST
                          [Emumet API]
```

## 現状カバレッジ (2026-08-24 時点)

実装済み: アカウント一覧 / 詳細 / 作成 (作成時 is_bot 設定を含む)、プロフィール編集、メタデータ CRUD、認証 (BFF 経由 Kratos + Hydra)、settings-hub。

## 不足画面 (feature 一覧)

バックエンド (Emumet REST API) に存在するがフロントエンド未実装の機能。優先度順:

| # | Feature | 種別 | 優先度 | バックエンド API |
|---|---------|------|--------|------------------|
| 1 | [account-deactivation](../features/account-deactivation/) | ユーザー | 高 | `DELETE /api/v1/accounts/{id}` |
| 2 | [follow](../features/follow/) | ユーザー | 高 | `POST /api/v1/accounts/{id}/follow` |
| 3 | [block-mute](../features/block-mute/) | ユーザー | 中 | `POST/GET /api/v1/accounts/{id}/{block,unblock,blocks,mute,unmute,mutes}` |
| 4 | [admin-moderation](../features/admin-moderation/) | 管理 | 中 | `POST /api/v1/admin/accounts/{id}/{suspend,unsuspend,ban}` |
| 5 | [oauth2-consent](../features/oauth2-consent/) | 認証 | 低 | `GET/POST /oauth2/consent` |

完了済み feature: settings-hub (ShuttlePub/RatCap#3)、[isbot-editing](../features/isbot-editing/)
(作成時設定のみ・編集 UI は D6 で意図的に非提供。2026-08-24 完了記録)。

## 共通の依存関係

- ほぼすべての feature は **BFF GraphQL スキーマ拡張** (`bff/schema.graphql`) が前提。変更後は `bun scripts/sync-graphql.ts` で PureScript 型を再生成する。
- **admin-moderation は blocked**: ロール解決の正源は Keto とし、Emumet にセッションコンテキスト解決エンドポイントを新設する方針 (2026-07-28 決定・Emumet 側実装中)。BFF は TTL キャッシュで利用する。
- block-mute の配置は決定済み (2026-07-28): 操作はアカウント個別ページ、一覧は Settings 配下。enforcement の正源は Emumet アクターレベルに据え置く。

## 共有 UI カタログ (ui-catalog)

共有デザイン/コンポーネントの確認基盤。Storybook は不採用 (PureScript/Flame では強みが活きないため)、Flame 製カスタムカタログ `apps/ui-catalog` を採用 (2026-09-05 storybook-introduction インタビュー確定)。

| ユニット | 内容 | 状態 |
|---|---|---|
| ui-catalog-foundation | カタログアプリ新設 + ショーケース + テーマ切替 + JSON manifest | stacked (2026-09-05) |
| ui-catalog-visual-diff-ci | Playwright スクショ + reg-suit/R2 + PR コメント画像埋め込み | backlog (depends on foundation) |
