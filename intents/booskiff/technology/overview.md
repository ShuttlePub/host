# Technology Overview — booskiff

確定 2026-08-29 (grill Q1-Q22)。
詳細な決定理由は `../interviews/booskiff.json`、決定一覧は `../decisions/2026-08-29-initial-shaping.md`。

## システム構成 (Q11=Q16 反転後)

2 リポジトリ + データ基盤。core (Rust) と web (PureScript + Bun BFF) は
リポジトリが分離する。

```
core/  Rust (Axum + PostgreSQL) — JWT 検証 (JWKS) + ストレージ/課金ドメイン
       認証フロー知識は持たない (Q3=A)。
       リポジトリ: ShuttlePub/Booskiff
web/   PureScript + Flame (SSR + hydration) + Bun BFF
       OAuth/OIDC フロー (Kratos/Hydra 連携、Ratcap bff/ ロジックの移植)、
       HTTP-only Cookie セッション、トークン更新、セッション→JWT 変換して
       core を内部呼び出し。
       リポジトリ: shuttlepub-frontends モノレポの apps/booskiff-web
       (core リポジトリとは分離。SSR off / サーバー関数 BFF / リポジトリ同居は廃止)
MinIO  S3 互換ストレージ (セルフホスト用。AWS S3 / R2 等にも差し替え可)
PostgreSQL — メタデータ・課金状態・セッション
```

ブラウザは JWT を一切見ない。機械 API (Emumet サーバー等) は JWT Bearer。

## スタック (Q2=A)

Rust + Axum + PostgreSQL + flake/just 開発環境は Emumet と統一。
層構成 (Emumet の kernel/application/driver/server 4 層) は Booskiff 規模に
合わせて再検証する (「A の材料で B の設計」を許容)。

**再検証の結論 (drive-foundation 実装で確定、2026-09-03)**: 4 層分割は行わず、
単一 crate (`core/`) のドメイン別モジュール構成を採用した
(`admin/`, `auth/`, `billing/`, `drive/`, `storage.rs` 等)。現規模ではモジュール
境界で十分で、層分割は将来規模が育った時点で再評価する。

## 転送経路 (Q5、既存サービス調査ベース)

- **アップロード**: クライアント → web/BFF → core → S3。サーバーがバイトを受け、
  サイズ計測・種別検証・上限チェックを保存前に実行。課金計量は「受けたバイト数」
  (Dropbox 式)。全バッファリング禁止でストリーミング受信
- **ダウンロード**: core が発行する短命 presigned URL でクライアントが S3 に直 GET。
  public-read ACL は使わない
- 参照: Misskey (アップ=サーバー経由、DL=S3 直) / Mastodon (DL=S3 直 or CDN) /
  Discord (200MiB 超のみ presigned アップ) の実例に準拠

REST surface 確定 (drive-foundation 実装): `/v1/folders`, `/v1/files`,
`/v1/files/{id}/download-url` (presigned), `/v1/files/{id}/publish`、
管理者系は `/v1/admin/*`、公開参照は `/public/{key}` (推測不能キー)。
運用エンドポイント `/healthz`・`/readyz` あり。完全版は Booskiff リポジトリの
`openapi.json` を正とする。

## ストレージバックエンド (Q6=A)

S3 互換のみ (MinIO でセルフホスト要件をカバー)。Emumet 内蔵のフォールバック S3 とは
別バケット・別論理構成で維持 (物理クラスタの共用は許可、論理分離は必須)。

## ドメインモデル (Q17/Q20/Q22)

- 初動にフォルダを含める (Q17=A)。階層はフラット (Q22=A): ファイル → フォルダは
  0..1 の folder_id 参照 (parent_id 自己参照ツリーは採用しない)
- owner はポリモーフィック (Q20=B): owner_type + owner_id で個人 / 組織の両方を許容。
  組織アカウントの管理機能 (メンバー招待・権限) は後続 slice
- サムネイル・画像変換は初動外 (Q17)。後続追加を非破壊にするため file レコードは
  「オリジナル + 派生オブジェクト」を許容する設計 (S3 キー prefix 規約 or
  file_objects 1:N) を初動から採用

## 課金 (Q7/Q8/Q18、Fluxer 実装調査ベース)

- Booskiff が課金ドメインを第一級で保持: プラン定義・サブスク状態・使用容量
- 計量対象はストレージ使用量 (受信バイト) のみ (Q18=A)。ダウンロード帯域・
  リクエスト数は初動外、必要時に拡張
- Fluxer 式: コード内デフォルト値テーブル (正) + DB 上書き層 (trait + rules)
  + 管理者 API (初動から)。セッション→JWT ではなくこちらも core 側で管理
- 価格・決済プロバイダは env 設定 (FLUXER_STRIPE_PRICE_* / FLUXER_STRIPE_ENABLED 相当)。
  抽象化 + 無効モードを初動から。Stripe 等の具体実装は運用ニーズ次第
- セルフホスト: premium_mode=everyone 相当 (全員が premium 相当の制限)。
  mirror モード (SaaS と同じ二層) も選択可
- revocation 前提: 短命 JWT + 期限切れ待ち (Q3)
- デフォルト制限 (Q21=A): 1 GB / user、100 MB / file、100 req/min。
  運用データを見て段階緩和

スキーマ確定形 (drive-foundation 実装、2026-09-03): DB 3 テーブル構成 —
`billing_rules` (DB 上書き層)、`storage_usage` (受信バイト計量)、
`plan_assignments` (プラン割当)。billing モジュールは
plans/rules/resolve/assignments/usage/provider 分割。

## 管理者 API (Q19=A)

管理者トークン (X-Admin-Token 等) + 単一ロール (admin) で初動実装。
後続の RBAC / OIDC 拡張を非破壊にするため:

- 全 endpoint は共通の認証ミドルウェア (トークン → 固定 admin ロール) 経由。
  単一グローバルトークンの直接判定は避ける
- リクエスト単位で principal を記録し、named token / token id による個別識別を行う
  (RBAC 移行後の監査証跡遡及のため)

## 開発・配布 (Q13=A)

- 開発環境: Nix flake (Rust toolchain + Bun)、direnv + just (Emumet と同体験)
- セルフホスト提供: `deploy/self-hosting/` に compose.yml / .env.example / Caddyfile
  (Fluxer の deploy/self-hosting/ と同じ形)。clone + compose up で動く
- リリース: git tag → GitHub Actions で ghcr.io コンテナイメージ
- E2E: compose 上で MinIO+Postgres 実コンテナ (Q15)

## SSR + hydration (Q16)

Q11 の初版 (TanStack Start / SSR off) を反転し、PureScript + Flame の SSR + hydration
+ Bun BFF を採用。発端は Ratcap の ShuttlePub フロントエンドモノレポ再編
(design-tokens → styles → ui → FrontApp + BFF) で、web は shuttlepub-frontends
モノレポの apps/booskiff-web に配置する。core (Rust) は JWT 検証のみの純粋性を維持。
