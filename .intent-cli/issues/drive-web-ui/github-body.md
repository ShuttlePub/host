## Goal

Booskiff (ShuttlePub の連携 Drive) の最小 Web UI を、shuttlepub-frontends モノレポの
`apps/booskiff-web` に新設する。PureScript + Flame (SSR + hydration) の Drive 画面
(ログイン、ファイル/フラットフォルダ一覧、アップロード、ダウンロード、削除) と、
認証・セッション・core 中継を担う Bun BFF を実装する。

## Why This Slice Exists Now

grill Q16 (D11 反転) で Web スタックが PureScript + Flame (SSR + hydration) + Bun BFF に確定し、
shuttlepub-frontends モノレポ配置が決まった。drive-foundation の packet 改訂 (2026-08-30) で
core + web の一体ユニットが core-only に分離され、本ユニットがその後続として切り出された。
core (Rust、ShuttlePub/Booskiff#1) が REST API を提供してから実装を開始する。

## Current Observed State

- shuttlepub-frontends モノレポは存在し、Ratcap 由来の BFF パターン (design-tokens → styles → ui → FrontApp + BFF) が参照実装としてある
- Booskiff core は未実装 (drive-foundation が queued、ShuttlePub/Booskiff#1)
- `apps/booskiff-web` は未作成

## Accepted Baseline You May Assume

- core は REST/OpenAPI (D10) を提供し、機械 API 認証は JWT Bearer。ブラウザは JWT を一切見ない (BFF がセッション→JWT 変換)
- アップロードは BFF → core へストリーミング中継 (100 MB/file 上限、受信バイト計量)。ダウンロードは core 発行の短命 presigned URL へのリダイレクト (D5)
- フォルダはフラット (1 階層、ファイル→フォルダは 0..1 の folder_id 参照、D21)。クォータは 1 GB/user (D20)
- 認証基盤は Kratos/Hydra (OAuth/OIDC)。セッションは HTTP-only Cookie、revocation は短命 JWT + 期限切れ待ち (D3)
- D1-D21 の決定一覧: `intents/booskiff/decisions/2026-08-29-initial-shaping.md`

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

Target paths: `apps/booskiff-web`

Target part: "Booskiff drive の最小 Web UI (Flame SSR + hydration) と Bun BFF"

## In Scope

- `apps/booskiff-web` Flame アプリ: SSR + hydration、ログイン、Drive 一覧 (ファイル + フラットフォルダ)、アップロード (進捗表示)、ダウンロード、削除、フォルダ CRUD、クォータ表示
- Bun BFF: OAuth/OIDC (Kratos/Hydra 連携、Ratcap bff/ パターン転用)、HTTP-only Cookie セッション、トークン更新、セッション→JWT 変換による core 内部呼び出し
- モノレポ配線 (workspace 登録、ビルド/開発スクリプト)
- Playwright Web E2E (D15、core + MinIO + Postgres + web の compose 上)

## Out Of Scope

- サムネイル・画像変換 (D16、後続 slice)
- 共有 (輸送) (D9、後続 slice)
- 組織アカウント管理 UI (D19、後続 slice)
- 管理者 UI、決済プロバイダ実装、Misskey 互換 API

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: shuttlepub-frontends リポジトリに `apps/booskiff-web` を
新設し、PureScript + Flame の SSR + hydration アプリと Bun BFF を実装して、Booskiff core の
REST API を使ったログイン・Drive 一覧・アップロード・ダウンロード・削除・フラットフォルダ
CRUD・クォータ表示が動作すること。ブラウザは JWT を一切保持せず、認証は HTTP-only Cookie
セッションで完結すること。Playwright E2E が compose 環境でグリーンであること。

## Acceptance Criteria

- SSR された Drive 画面 (ファイル/フォルダ一覧) が hydration され、ログイン・一覧表示がブラウザのみで完結する
- BFF 経由の OAuth/OIDC ログインが HTTP-only Cookie セッションで完結し、ブラウザの storage に JWT が残らない
- アップロードが BFF → core へストリーミング中継され、100 MB/file 上限・進捗表示・クォータ更新が動く
- ダウンロードが presigned URL へのリダイレクトで完結し、削除・フラットフォルダ CRUD が動く
- Playwright Web E2E (D15) が core + MinIO + Postgres + web の compose 上でグリーン

## Verification

- PureScript コンパイル・production build が通る
- BFF 単体テスト (セッション管理・JWT 変換・core 中継のモックテスト) がグリーン
- Playwright Web E2E が compose 環境でグリーン
- `git diff --check`

## Related Links

- 先行ユニット: ShuttlePub/Booskiff#1 (drive-foundation、core REST API)
- 決定一覧: `intents/booskiff/decisions/2026-08-29-initial-shaping.md` (D1-D21)
- 技術概要: `intents/booskiff/technology/overview.md`
- マップ: `intents/booskiff/intent-tree/00-map.md`

## Knowledge Maintenance

- Intent placement: `intents/booskiff/intent-tree/00-map.md` の drive-web-ui 行を更新 (新規 intent 不要)
- ADR candidate: none (D11/Q16 は決定一覧に記録済み)
- Diagram candidate: none
- Docs update: none (初動 slice)
- Closeout writeback expected: yes (Flame SSR + hydration × Bun BFF の実装上の知見を `technology/overview.md` へ)

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が
shuttlepub-frontends リポジトリ (apps/booskiff-web) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
