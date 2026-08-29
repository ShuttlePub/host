# drive-foundation Implementation Packet

## Goal

Booskiff (ShuttlePub 群のファイル保管サービス、Misskey Drive 的 UX) の初期基盤を 1 実行単位で構築する: Rust core (認証 + Drive CRUD + S3 保存基盤 + 課金ポリシー土台) と、TanStack Start (SSR off) の最小 Web UI (ログイン + Drive 一覧/アップロード/削除) を、`deploy/self-hosting/` の compose でブラウザから直接使える状態にする。

## Why

- ShuttlePub サービス群で唯一の課金ポイントとして、課金ポリシー土台は後付けではなく初動から入れる (decisions D1、課金の後付け設計リスク回避)。
- Emumet からのアイコン/バナー参照連携は API 経由で進められるため、初動でブラウザ UI まで揃えれば「単体運用も第一級」の体験を早期に検証できる (D14)。

## Scope

- **core/ (Rust, Axum + PostgreSQL、flake/just 環境)**
  - JWT 認証: 設定で受け取った信頼 issuer の JWKS による署名検証のみ (トークン発行・セッションは持たない)。revocation は短命トークン + 期限切れ待ち
  - Account 単位 Drive の CRUD: アップロード (サーバー経由・ストリーミング受信・全バッファリング禁止)、一覧、メタデータ表示、削除。受信バイトを正確に計測し、プラン容量上限を超過するアップロードを拒否
  - S3 互換ストレージ基盤: MinIO 等の S3 互換エンドポイントをバックエンドに設定必須。ダウンロードは短命 presigned URL を発行しクライアントが S3 に直 GET (public-read ACL は使わない)
  - 課金ポリシー (Fluxer 式): コード内デフォルト値テーブル (正) + DB 上書き層 (trait + rules) + 管理者 API。env で価格・決済プロバイダ設定 (抽象化 + 無効モード、具体プロバイダ実装は含めない)。セルフホストは everyone 相当 (全員 premium 制限) で mirror モードも選択可
  - 公開参照: ファイルはデフォルト非公開。公開 API で推測不能キー付き公開 URL (immutable キャッシュ) を発行/無効化。2 値のみ (中間範囲なし)
  - OpenAPI 駆動の独自 REST API。Account コンテキストのみ (Profile 概念は出さない)
- **web/ (TanStack Start、SSR off、Bun)**
  - サーバー関数/API ルートで BFF を兼任: OAuth/OIDC フロー (Kratos/Hydra 連携)、HTTP-only Cookie セッション発行・管理、トークン更新、セッション→JWT 変換で core を内部呼び出し。ブラウザは JWT を見ない
  - 最小 UI: ログイン、Drive 一覧、アップロード、削除
- **deploy/self-hosting/**: compose.yml / .env.example / Caddyfile。MinIO + PostgreSQL + web + core が起動しブラウザから使える
- **CI**: tag → ghcr.io コンテナイメージビルド。E2E 用の compose 構成

## Out of scope

- 共有 (輸送) 機能 (リンク型/Account 型どちらも)。設計論点は `intents/booskiff/product/overview.md` にメモ
- copy 系 API (Profile 移管用)、組織 Drive の詳細 (課金・容量の組織単位適用)
- 支払いプロバイダの具体実装 (Stripe 等)。抽象化インターフェース + 無効モードのみ
- 単体運用モードの認証 (Kratos 同居 or 簡易ローカル認証)。初動は連携 issuer 前提
- Misskey Drive API 互換レイヤー
- followers 限定等の中間公開範囲
- 大ファイルのサイズ分岐 (Discord 式)、負荷テスト、S3 互換マトリクス検証 (MinIO 以外)

## Verification

1. core 単体・結合テスト (Rust): ドメインルール、課金計量の正確性 (受信バイト記録・容量上限超過拒否)、presigned URL 発行、公開フラグ/公開 URL 制御
2. compose 上 E2E (API レベル): test issuer で JWT 発行 → アップロード → 計量記録 → presigned ダウンロード → 公開フラグ/URL → 削除。MinIO + PostgreSQL 実コンテナ
3. web E2E (Playwright): ログイン → アップロード → 一覧表示 → 削除 (セッション Cookie 経由で core に到達することを含む)
4. `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/booskiff/intent-tree/00-map.md` (初動 shaping の書き戻しは packet 作成時に実施済み。実装で確定した構成がずれたら更新)
- ADR candidate: なし (決定は `intents/booskiff/decisions/2026-08-29-initial-shaping.md` D1-D15 に記録済み。実装で変わった場合は同ファイルに追記)
- Diagram candidate: なし
- Docs update: なし (ユーザードキュメントは運用フェーズ)
- Closeout learning: 層構成の再検討結果・課金スキーマの確定形など、実装で変わった決定を `technology/overview.md` / `decisions/` に追記する (`write_back_required: true`)

- Guide reachability (G645): implementation-loop ガイド → implementation ロール → ShuttlePub/Booskiff (core/, web/)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
