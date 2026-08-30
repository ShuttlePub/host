## Goal

Booskiff (ShuttlePub 群のファイル保管サービス) の core 初期基盤を構築する: Rust core (JWT 認証 + owner 単位 Drive CRUD + S3 互換保存 + 課金ポリシー土台 + 管理者 API) を、セルフホスト用 compose で MinIO + PostgreSQL と共に起動し API が直接使える状態にする。

> **スコープ改訂 (2026-08-30)**: 本 issue は初出時「core + 最小 Web UI (TanStack Start)」を含めていたが、grill Q16 (D11 反転) で web を PureScript + Flame + Bun BFF に変更し shuttlepub-frontends モノレポ (apps/booskiff-web) に分離した。**本 issue は core のみ**。Web UI は依存実行単位 `drive-web-ui` (対象: shuttlepub-frontends モノレポ) が配達する。

## Why This Slice Exists Now

ShuttlePub サービス群で唯一の課金ポイントとして、課金ポリシー土台は初動から入れることが決まっている (decisions D1)。本 slice は認証・Drive CRUD・S3 基盤・課金土台・管理者 API を 1 実行単位で揃え、Emumet からのアイコン/バナー参照連携 (API 経由) を即座に可能にする最初の着地地点にする。

## Current Observed State

`ShuttlePub/Booskiff` リポジトリは bootstrap 直後で実装は空。ホスト側の intent (`intents/booskiff/`) に初動 shaping (grill Q1-Q22) の決定が記録済み。

## Accepted Baseline You May Assume

- Rust (Axum) + PostgreSQL + flake/just 開発環境 (Emumet と同系)。層構成は Booskiff 規模に再検査してよい
- S3 互換ストレージ (MinIO 等) をバックエンドに必須。Emumet 内蔵フォールバック S3 とは別バケット・論理分離
- 認証は信頼 issuer の JWT を JWKS で検証のみ。トークン発行・セッション管理は core が持たない (web/BFF が担当、本 slice では対象外)
- 独自 REST/OpenAPI。Misskey Drive API 互換は持たない。Profile 概念を API に出さない (Account コンテキストのみ)
- 設計の詳細・根拠は `intents/booskiff/product/overview.md` / `technology/overview.md` / `decisions/2026-08-29-initial-shaping.md` (ホストリポジトリ ShuttlePub/host) にある

## Target Repo / Path / Part

Repository: `ShuttlePub/Booskiff`

Target paths: `core/`, `deploy/self-hosting/`, `flake.nix`

Target part: Booskiff core の初期基盤 (Rust: 認証 + Drive CRUD + S3 基盤 + 課金ポリシー土台 + 管理者 API)。Web UI は shuttlepub-frontends モノレポ対象の別実行単位 drive-web-ui

## In Scope

- core (Rust): JWKS による JWT 検証、owner 単位 (`owner_type` + `owner_id` ポリモーフィック) Drive CRUD (ストリーミング受信・バイト計測・デフォルト制限 1 GB/user・100 MB/file・100 req/min での超過拒否)、フラット (1 階層) フォルダ (ファイル → フォルダ 0..1 参照)、file レコードの派生オブジェクト許容設計 (S3 キー prefix 規約 or `file_objects` 1:N、初動はオリジナルのみ)、S3 互換保存・presigned URL 発行、課金ポリシー (コード内デフォルト + DB 上書き + 管理者 API、計量は受信バイトのみ、env 設定の決済抽象化)、管理者 API (named token + 共通認証ミドルウェア経由の固定 admin ロール)、公開フラグ + 推測不能キー付き公開 URL、OpenAPI
- deploy/self-hosting/: compose で MinIO + PostgreSQL + core が起動 (web は含めない)
- CI: tag → ghcr.io イメージ、E2E 用 compose

## Out Of Scope

- Web UI 全般 (ログイン、Drive 一覧/アップロード/削除 UI、BFF、セッション管理) — 実行単位 `drive-web-ui` (shuttlepub-frontends モノレポ) が担当
- 共有 (輸送) 機能、copy 系 API、組織 Drive 詳細、組織アカウント管理機能
- サムネイル・画像変換ジョブ (派生オブジェクト許容の土台設計のみ本 slice)
- 支払いプロバイダの具体実装 (Stripe 等。抽象化 + 無効モードのみ)
- 単体運用モードの認証 (初動は連携 issuer 前提)
- Misskey API 互換、中間公開範囲 (followers 限定等)、大ファイル分岐、負荷テスト

## Standalone Child Issue Contract

この PR が配達するもの: `ShuttlePub/Booskiff` において、Rust core が設定された信頼 issuer の JWT を JWKS で検証し、owner 単位 (`owner_type` + `owner_id`) の Drive でファイルのアップロード (サーバー経由・計量・制限拒否付き) / 一覧 / 表示 / 削除を提供し、フラットなフォルダ (0..1 参照) を持ち、S3 互換ストレージに保存・presigned URL でダウンロードさせ、Fluxer 式の課金ポリシー (コード内デフォルト + DB 上書き + 管理者 API、計量は受信バイトのみ、セルフホスト everyone/mirror) を持ち、named token + 共通認証ミドルウェアによる管理者 API を持ち、2 値の公開制御 (非公開 / 推測不能公開 URL) を持つこと。file レコードは派生オブジェクト (サムネイル等) を非破壊で追加できる構造であること。`deploy/self-hosting/` の compose で MinIO + PostgreSQL + core が起動し API が使えること。

## Acceptance Criteria

- core: 信頼 issuer の JWT を JWKS で検証し Account コンテキストを解決できる (検証のみ)
- core: Drive CRUD が動く。アップロードはサーバー経由で受信バイトを正確に計測し、デフォルト制限 (1 GB/user、100 MB/file、100 req/min) で超過を拒否できる
- core: フラット (1 階層) のフォルダ。ファイル → フォルダは 0..1 の folder_id 参照 (parent_id ツリーなし)
- core: file レコードが「オリジナル + 派生オブジェクト」を許容する設計 (S3 キー prefix 規約 or file_objects 1:N)
- core: 課金ポリシー (コード内デフォルト + DB 上書き + 管理者 API) が動く。計量は受信バイトのみ。セルフホスト everyone / mirror モード選択可
- core: 管理者 API が named token を共通認証ミドルウェア (トークン → 固定 admin ロール) 経由で検証する。エンドポイントはグローバルトークン直接判定を持たない
- core: ダウンロードは短命 presigned URL で S3 直 GET。public-read ACL 不使用
- core: デフォルト非公開。公開参照は推測不能キー付き公開 URL (immutable キャッシュ)、解除・削除で無効化
- 検証: (1) core 単体・結合テスト (計量・制限拒否・presigned・公開制御・フォルダ・管理者 API) (2) compose E2E (認証→アップ→計量→presigned DL→フォルダ→公開→削除)
- deploy/self-hosting/ の compose で MinIO+Postgres+core が起動し API が使える

## Verification

- 上記 2 層検証 (core テスト / compose E2E) がすべて通る
- `git diff --check`

## Related Links

- intents/booskiff/intent-tree/00-map.md (ShuttlePub/host)
- intents/booskiff/product/overview.md、technology/overview.md (同)
- intents/booskiff/decisions/2026-08-29-initial-shaping.md (D1-D21、同)
- intents/booskiff/features/emumet-handoff-requirements.md (後続 slice への委譲事項、同)

## Knowledge Maintenance

- Intent placement: `intents/booskiff/intent-tree/00-map.md` (実装で確定形がずれたら更新)
- ADR candidate: なし (D1-D21 に記録済み。変わったら追記)
- Diagram candidate: なし
- Docs update: なし
- Closeout writeback expected: yes — 層構成・課金スキーマ等の確定形を `technology/overview.md` / `decisions/` へ

## Guide Reachability (G645)

implementation-loop ガイド (host、G338) → implementation ロール → ShuttlePub/Booskiff (core/)。本 slice で追加する role-facing surface は子リポジトリの実装面のみ。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
