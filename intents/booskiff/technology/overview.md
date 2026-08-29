# Technology Overview — booskiff

確定 2026-08-29 (grill Q2/Q3/Q5/Q6/Q7/Q8/Q11/Q13)。
詳細な決定理由は `../interviews/booskiff.json`。

## システム構成 (Q11)

単一リポジトリ (`ShuttlePub/Booskiff`)、2 プロセス + データ基盤。

```
web/   TanStack Start (SSR off) — SPA + BFF 兼任
       サーバー関数/API ルート: OAuth/OIDC フロー (Kratos/Hydra 連携、
       RatCap bff/ ロジックの TS 移植)、HTTP-only Cookie セッション、
       トークン更新、セッション→JWT 変換して core を内部呼び出し
core/  Rust (Axum + PostgreSQL) — JWT 検証 (JWKS) + ストレージ/課金ドメイン
       認証フロー知識は持たない (Q3=A)
MinIO  S3 互換ストレージ (セルフホスト用。AWS S3 / R2 等にも差し替え可)
PostgreSQL — メタデータ・課金状態・セッション
```

ブラウザは JWT を一切見ない。機械 API (Emumet サーバー等) は JWT Bearer。

## スタック (Q2=A)

Rust + Axum + PostgreSQL + flake/just 開発環境は Emumet と統一。
層構成 (Emumet の kernel/application/driver/server 4 層) は Booskiff 規模に
合わせて再検証する (「A の材料で B の設計」を許容)。

## 転送経路 (Q5=B、既存サービス調査ベース)

- **アップロード**: クライアント → web/BFF → core → S3。サーバーがバイトを受け、
  サイズ計測・種別検証・上限チェックを保存前に実行。課金計量は「受けたバイト数」
  (Dropbox 式)。全バッファリング禁止でストリーミング受信
- **ダウンロード**: core が発行する短命 presigned URL でクライアントが S3 に直 GET。
  public-read ACL は使わない
- 参照: Misskey (アップ=サーバー経由、DL=S3 直) / Mastodon (DL=S3 直 or CDN) /
  Discord (200MiB 超のみ presigned アップ) の実例に準拠

## ストレージバックエンド (Q6=A)

S3 互換のみ (MinIO でセルフホスト要件をカバー)。Emumet 内蔵のフォールバック S3 とは
別バケット・別論理構成で維持 (物理クラスタの共用は許可、論理分離は必須)。

## 課金 (Q7=A, Q8=B、Fluxer 実装調査ベース)

- Booskiff が課金ドメインを第一級で保持: プラン定義・サブスク状態・使用容量
- Fluxer 式: コード内デフォルト値テーブル (正) + DB 上書き層 (trait + rules)
  + 管理者 API (初動から)。セッション→JWT ではなくこちらも core 側で管理
- 価格・決済プロバイダは env 設定 (FLUXER_STRIPE_PRICE_* / FLUXER_STRIPE_ENABLED 相当)。
  抽象化 + 無効モードを初動から。Stripe 等の具体実装は運用ニーズ次第
- セルフホスト: premium_mode=everyone 相当 (全員が premium 相当の制限)。
  mirror モード (SaaS と同じ二層) も選択可
- revocation 前提: 短命 JWT + 期限切れ待ち (Q3)

## 開発・配布 (Q13=A)

- 開発環境: Nix flake (Rust toolchain + Bun)、direnv + just (Emumet と同体験)
- セルフホスト提供: `deploy/self-hosting/` に compose.yml / .env.example / Caddyfile
  (Fluxer の deploy/self-hosting/ と同じ形)。clone + compose up で動く
- リリース: git tag → GitHub Actions で ghcr.io コンテナイメージ
- E2E: compose 上で MinIO+Postgres 実コンテナ (Q15)

## SSR off の理由 (Q11 補足)

認証ゲートのみの管理画面で SSR の便益が薄い / hydration 問題のクラスを消せる /
セッション+サーバー関数構成と相性が良い。将来の公開画面 (共有リンク等) は
selective SSR でルート単位に有効化可能。
