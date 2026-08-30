# drive-foundation Implementation Packet

## Goal

Booskiff (ShuttlePub 群のファイル保管サービス、Misskey Drive 的 UX) の core 初期基盤を 1 実行単位で構築する: Rust core (認証 + Drive CRUD + S3 保存基盤 + 課金ポリシー土台 + 管理者 API) を、`deploy/self-hosting/` の compose で MinIO + PostgreSQL と共に起動し API が直接使える状態にする。

**スコープ改訂 (2026-08-30)**: 本 packet は初動 shaping 確定時 (grill Q1-Q15 時点) では「core + 最小 Web UI (TanStack Start)」を含めていたが、Q16 (D11 反転) で web を PureScript + Flame + Bun BFF に変更し shuttlepub-frontends モノレポ (apps/booskiff-web) に分離した。よって本実行単位は **core のみ**。Web UI は依存実行単位 `drive-web-ui` (対象: shuttlepub-frontends モノレポ) が配達する。

## Why

- ShuttlePub サービス群で唯一の課金ポイントとして、課金ポリシー土台は後付けではなく初動から入れる (decisions D1、課金の後付け設計リスク回避)。
- Emumet からのアイコン/バナー参照連携は API 経由で進められるため、core のみでも即座に連携価値を出せる (D14)。

## Scope

- **core/ (Rust, Axum + PostgreSQL、flake/just 環境)**
  - JWT 認証: 設定で受け取った信頼 issuer の JWKS による署名検証のみ (トークン発行・セッションは持たない)。revocation は短命トークン + 期限切れ待ち
  - owner 単位 Drive の CRUD: owner は `owner_type` + `owner_id` のポリモーフィック (D19、個人 / 組織の両方を許容。組織管理機能自体は後続)。アップロードはサーバー経由・ストリーミング受信・全バッファリング禁止。受信バイトを正確に計測し、デフォルト制限 (D20: 1 GB / user、100 MB / file、100 req / min) で超過を拒否
  - フラット (1 階層) のフォルダ (D16/D21): ファイル → フォルダは 0..1 の `folder_id` 参照。`parent_id` 自己参照ツリーは持たない
  - file レコードの派生オブジェクト許容設計 (D16): 「オリジナル + 派生 (サムネイル等)」を非破壊で追加できる構造 (S3 キー prefix 規約 or `file_objects` 1:N)。初動ではオリジナルのみ実装
  - S3 互換ストレージ基盤: MinIO 等の S3 互換エンドポイントをバックエンドに設定必須。ダウンロードは短命 presigned URL を発行しクライアントが S3 に直 GET (public-read ACL は使わない)
  - 課金ポリシー (Fluxer 式): コード内デフォルト値テーブル (正) + DB 上書き層 (trait + rules) + 管理者 API。計量はストレージ使用量 (受信バイト) のみ (D17、ダウンロード帯域・リクエスト数は初動外)。env で価格・決済プロバイダ設定 (抽象化 + 無効モード、具体プロバイダ実装は含めない)。セルフホストは everyone 相当 (全員 premium 制限) で mirror モードも選択可
  - 管理者 API (D18): 管理者トークン (named token / token id、複数発行・個別無効化) を共通認証ミドルウェア経由で検証 — ミドルウェアは「トークン → 固定 admin ロール」の抽象化を持ち、エンドポイント側はグローバルトークン直接判定を持たない (RBAC / OIDC への後続拡張で endpoint 無変更にするため)
  - 公開参照: ファイルはデフォルト非公開。公開 API で推測不能キー付き公開 URL (immutable キャッシュ) を発行/無効化。2 値のみ (中間範囲なし)
  - OpenAPI 駆動の独自 REST API。Account コンテキストのみ (Profile 概念は出さない)
- **deploy/self-hosting/**: compose.yml / .env.example / Caddyfile。MinIO + PostgreSQL + core が起動し API が使える (web は含めない)
- **CI**: tag → ghcr.io コンテナイメージビルド。E2E 用の compose 構成

## Out of scope

- Web UI 全般 (ログイン画面、Drive 一覧/アップロード/削除 UI、BFF、セッション管理) — 依存実行単位 `drive-web-ui` (shuttlepub-frontends モノレポ) が担当
- 共有 (輸送) 機能 (リンク型/Account 型どちらも)。設計論点は `intents/booskiff/product/overview.md` にメモ
- サムネイル・画像変換ジョブ (D16: 派生オブジェクト許容の土台設計のみ本 slice、変換ジョブ・ライブラリ選定は後続 slice)
- copy 系 API (Profile 移管用)、組織 Drive の詳細 (課金・容量の組織単位適用)、組織アカウントの管理機能 (メンバー招待・権限)
- 管理者 RBAC / OIDC 連携 (D18: ミドルウェア抽象化と named token は初動済み、ロール複雑化は後続)
- 支払いプロバイダの具体実装 (Stripe 等)。抽象化インターフェース + 無効モードのみ
- 単体運用モードの認証 (Kratos 同居 or 簡易ローカル認証)。初動は連携 issuer 前提
- Misskey Drive API 互換レイヤー
- followers 限定等の中間公開範囲
- 大ファイルのサイズ分岐 (Discord 式)、負荷テスト、S3 互換マトリクス検証 (MinIO 以外)

## Verification

1. core 単体・結合テスト (Rust): ドメインルール、課金計量の正確性 (受信バイト記録・制限超過拒否)、presigned URL 発行、公開フラグ/公開 URL 制御、フォルダ (フラット・0..1 参照)、管理者 API (named token 検証・ミドルウェア抽象化)
2. compose 上 E2E (API レベル): test issuer で JWT 発行 → アップロード → 計量記録 → presigned ダウンロード → フォルダ割り当て → 公開フラグ/URL → 削除。MinIO + PostgreSQL 実コンテナ
3. `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/booskiff/intent-tree/00-map.md` (実装で確定した構成がずれたら更新)
- ADR candidate: なし (決定は `intents/booskiff/decisions/2026-08-29-initial-shaping.md` D1-D21 に記録済み。実装で変わった場合は同ファイルに追記)
- Diagram candidate: なし
- Docs update: なし (ユーザードキュメントは運用フェーズ)
- Closeout learning: 層構成の再検討結果・課金スキーマの確定形など、実装で変わった決定を `technology/overview.md` / `decisions/` に追記する (`write_back_required: true`)

- Guide reachability (G645): implementation-loop ガイド → implementation ロール → ShuttlePub/Booskiff (core/)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
