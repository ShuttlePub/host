## Goal

Booskiff (ShuttlePub 群のファイル保管サービス) の初期基盤を構築する: Rust core (JWT 認証 + Account 単位 Drive CRUD + S3 互換保存 + 課金ポリシー土台) と TanStack Start の最小 Web UI (ログイン + Drive 一覧/アップロード/削除) を、セルフホスト用 compose でブラウザから直接使える状態にする。

## Why This Slice Exists Now

ShuttlePub サービス群で唯一の課金ポイントとして、課金ポリシー土台は初動から入れることが決まっている (decisions D1)。本 slice は認証・Drive CRUD・S3 基盤・課金土台・最小 UI を 1 実行単位で揃え、Emumet からのアイコン/バナー参照連携 (API 経由) と「単体運用も第一級」のブラウザ体験を両立させる最初の着地地点にする。

## Current Observed State

`ShuttlePub/Booskiff` リポジトリは bootstrap 直後で実装は空。ホスト側の intent (`intents/booskiff/`) に初動 shaping (grill Q1-Q15) の決定が記録済み。

## Accepted Baseline You May Assume

- Rust (Axum) + PostgreSQL + flake/just 開発環境 (Emumet と同系)。層構成は Booskiff 規模に再検査してよい
- S3 互換ストレージ (MinIO 等) をバックエンドに必須。Emumet 内蔵フォールバック S3 とは別バケット・論理分離
- 認証は信頼 issuer の JWT を JWKS で検証のみ。トークン発行・セッション管理は core が持たない (web/BFF が担当)
- 独自 REST/OpenAPI。Misskey Drive API 互換は持たない。Profile 概念を API に出さない (Account コンテキストのみ)
- 設計の詳細・根拠は `intents/booskiff/product/overview.md` / `technology/overview.md` / `decisions/2026-08-29-initial-shaping.md` (ホストリポジトリ ShuttlePub/host) にある

## Target Repo / Path / Part

Repository: `ShuttlePub/Booskiff`

Target paths: `core/`, `web/`, `deploy/self-hosting/`, `flake.nix`

Target part: Booskiff 全体の初期基盤 (Rust core + TanStack Start web + セルフホスト配布構成)

## In Scope

- core (Rust): JWKS による JWT 検証、Account 単位 Drive CRUD (ストリーミング受信・バイト計測・容量上限拒否)、S3 互換保存・presigned URL 発行、課金ポリシー (コード内デフォルト + DB 上書き + 管理者 API + env 設定の決済抽象化)、公開フラグ + 推測不能キー付き公開 URL、OpenAPI
- web (TanStack Start, SSR off): OAuth/OIDC ログイン (Kratos/Hydra 連携)、HTTP-only Cookie セッション、サーバー関数による core 内部呼び出し、Drive 一覧/アップロード/削除 UI
- deploy/self-hosting/: compose で MinIO + PostgreSQL + web + core が起動
- CI: tag → ghcr.io イメージ、E2E 用 compose

## Out Of Scope

- 共有 (輸送) 機能、copy 系 API、組織 Drive 詳細
- 支払いプロバイダの具体実装 (Stripe 等。抽象化 + 無効モードのみ)
- 単体運用モードの認証 (初動は連携 issuer 前提)
- Misskey API 互換、中間公開範囲 (followers 限定等)、大ファイル分岐、負荷テスト

## Standalone Child Issue Contract

この PR が配達するもの: `ShuttlePub/Booskiff` において、(1) Rust core が設定された信頼 issuer の JWT を JWKS で検証し、Account 単位の Drive でファイルのアップロード (サーバー経由・計量・容量上限拒否付き) / 一覧 / 表示 / 削除を提供し、S3 互換ストレージに保存・presigned URL でダウンロードさせ、Fluxer 式の課金ポリシー (コード内デフォルト + DB 上書き + 管理者 API、セルフホスト everyone/mirror) を持ち、2 値の公開制御 (非公開 / 推測不能公開 URL) を持つこと。(2) TanStack Start (SSR off) の web が OAuth/OIDC ログイン + HTTP-only Cookie セッションで core を内部利用し、ブラウザに JWT を見せず Drive UI (一覧/アップロード/削除) を提供すること。(3) `deploy/self-hosting/` の compose で MinIO + PostgreSQL + web + core が起動しブラウザから使えること。

## Acceptance Criteria

- core: 信頼 issuer の JWT を JWKS で検証し Account コンテキストを解決できる (検証のみ)
- core: Drive CRUD が動く。アップロードはサーバー経由で受信バイトを正確に計測し、容量上限超過を拒否できる
- core: 課金ポリシー (コード内デフォルト + DB 上書き + 管理者 API) が動く。セルフホスト everyone / mirror モード選択可
- core: ダウンロードは短命 presigned URL で S3 直 GET。public-read ACL 不使用
- core: デフォルト非公開。公開参照は推測不能キー付き公開 URL (immutable キャッシュ)、解除・削除で無効化
- web: OAuth/OIDC ログイン + HTTP-only Cookie セッションで、ブラウザが JWT を見ない Drive UI (一覧/アップロード/削除) が使える
- 検証: (1) core 単体・結合テスト (計量・上限拒否・presigned・公開制御) (2) compose E2E (認証→アップ→計量→presigned DL→公開→削除) (3) web E2E (Playwright): ログイン→アップロード→一覧→削除
- deploy/self-hosting/ の compose でブラウザから Drive UI が使える

## Verification

- 上記 3 層検証 (core テスト / compose E2E / Playwright) がすべて通る
- `git diff --check`

## Related Links

- intents/booskiff/intent-tree/00-map.md (ShuttlePub/host)
- intents/booskiff/product/overview.md、technology/overview.md (同)
- intents/booskiff/decisions/2026-08-29-initial-shaping.md (D1-D15、同)
- intents/booskiff/features/emumet-handoff-requirements.md (後続 slice への委譲事項、同)

## Knowledge Maintenance

- Intent placement: `intents/booskiff/intent-tree/00-map.md` (実装で確定形がずれたら更新)
- ADR candidate: なし (D1-D15 に記録済み。変わったら追記)
- Diagram candidate: なし
- Docs update: なし
- Closeout writeback expected: yes — 層構成・課金スキーマ等の確定形を `technology/overview.md` / `decisions/` へ

## Guide Reachability (G645)

implementation-loop ガイド (host、G338) → implementation ロール → ShuttlePub/Booskiff (core/, web/)。本 slice で追加する role-facing surface は子リポジトリの実装面のみ。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
