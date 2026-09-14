## Goal

booskiff-web の real モード (USE_MOCK=false, Hydra OIDC) 認証フローを、Hydra+Kratos 入りの実スタック compose で E2E 検証する基盤を追加する。

## Why This Slice Exists Now

issue #10 (PR #9 レビュー残件) の Medium-2 で「real モードの E2E が存在しない」が指摘され、PR #14 から独立 unit として分離された。PR #14 で real callback のハードニング (id_token 署名/issuer/audience/expiry 検証、missing_id_token fail-closed、auth ルート method 405、/api mutation の Origin/Referer 検証) が入ったが、カバーは mock JWKS サーバーによる単体テストであり、実 Hydra との結合は未検証のまま残っている。

## Current Observed State

- mock モード (USE_MOCK=true) の実スタック E2E は compose.e2e.yml + Playwright で 16 件動作している
- real モードの E2E は存在しない。Hydra+Kratos を起動する compose 定義・Kratos identity の seed・real 認証フローの Playwright シナリオのいずれも未整備
- real OAuth 経路 (bff/auth-real.ts) 自体は emumet-web からの踏襲 + PR #14 のハードニング済みで、単体テスト 97 件でカバーされている

## Accepted Baseline You May Assume

- apps/booskiff-web は main に存在し、mock E2E・単体テスト (bun/spago) は全て green
- PR #14 のハードニング (id_token 検証・fail-closed・405・Origin 検証) はマージ済みで変更不要
- emumet-web に real OAuth 経路の先例があり、Hydra/Kratos の compose 設定はそこから移植可能

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/booskiff-web/e2e, compose.e2e.yml (または新規 compose.e2e.real.yml), .github/workflows`

Target part: `booskiff-web の real モード (Hydra OIDC) 認証フロー実検証 E2E 基盤`

## In Scope

- Hydra + Kratos (+ DB / マイグレーション / OAuth クライアント登録) を含む real モード用 compose 定義
- Kratos identity の seed/provisioning (テストユーザー)
- Playwright real E2E: ログイン → Hydra 認可 → callback → セッション発行 → 認証済み drive 操作 → logout
- 実設定で再現可能な範囲の負の系 (fail-closed 確認)
- CI 統合 (mock/real 両スイートが green になる構成)
- child repo README への real E2E ローカル実行手順の追記

## Out Of Scope

- 既存 mock E2E・単体テストの変更 (壊さないこと)
- booskiff-web の新機能・認証ロジックの変更 (実設定で不具合を検出した場合は別 issue 化して報告)
- Hydra/Kratos の本番デプロイ設定

## Standalone Child Issue Contract

Hydra+Kratos 入り compose で USE_MOCK=false の booskiff-web スタックを起動し、real OAuth ログインから logout までの E2E を Playwright で実装して CI に統合する。既存の mock E2E と単体テストを一切壊さず、CI で mock/real 両スイートが green になることが完了条件。

## Acceptance Criteria

- Hydra+Kratos 入り compose で real モードスタックが起動し、real OAuth ログイン → callback → セッション発行 → 認証済み drive 操作 → logout の E2E がパスする
- 不正な認証応答 (実設定で再現可能な範囲) でログインが失敗しセッションが発行されないことが確認できる
- 既存 mock E2E 16 件・bun test・spago test が引き続き全パスし、CI で両スイート green

## Verification

- real スイート全パスの実実行出力を PR に記載
- 既存スイート (mock E2E / bun test / spago test) 全パス
- `git diff --check` clean

## Related Links

- shuttlepub-frontends issue #10 (Medium-2 の分離元)
- shuttlepub-frontends PR #14 (real callback ハードニング、Deferred 節に本 unit の経緯)

## Knowledge Maintenance

- Intent placement: `intents/ratcap/intent-tree/00-map.md` に行追加 (新規ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: child repo README に real E2E 実行手順を追記 (host 側 docs 更新なし)
- Closeout writeback expected: yes — Hydra+Kratos E2E の起動時間/安定性/CI コストと実設定での挙動差異を `intents/ratcap/technology/overview.md` へ

## Guide Reachability (G645)

`guide workflow task implementation-loop` → role: implementation → shuttlepub-frontends (apps/booskiff-web/e2e, compose.e2e.yml, .github/workflows)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
