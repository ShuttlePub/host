## Goal

real モード (USE_MOCK=false) で、ログインフォーム送信 (Kratos 認証) 成功後に Hydra OAuth 開始までが UI 導線として自動的に完結するようにする。

## Why This Slice Exists Now

hydra-oidc-real-e2e (#15 / PR #18) の実スタック E2E でこの不具合が確定的に再現した (#17 として起票済)。E2E は明示遷移で回避しているが、real モードを実運用可能にするには導線修正が必須。

## Current Observed State

- `apps/booskiff-web/src/Client/Update.purs:311-317` が login 成功 (`POST /auth/login` → `LoginResponse.authenticated`) を直接 `SessionChecked` にマップする
- real BFF の login は Kratos cookie を forward するだけで `booskiff_session` を発行しない。セッション確立には `/auth/oauth/start` による PKCE フローが必須
- 結果として real モードではログイン後に /drive へ遷移するが API が 401 を返す

## Accepted Baseline You May Assume

- mock モードは `bff/auth-mock.ts` の mockLogin が直接セッションを発行するため無影響。mock 導線 (E2E 16 件) を壊さないこと
- real E2E 基盤 (Hydra+Kratos compose、bridge、seed) は #15 / PR #18 で main にマージ済み
- id_token 検証・fail-closed 等の認証セキュリティは PR #14 の状態を維持すること

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`
Path: `apps/booskiff-web/src` (Client/Update.purs), `apps/booskiff-web/bff`, `apps/booskiff-web/e2e/real`
Part: real モードのログイン → OAuth 開始導線

## Acceptance Criteria

1. real モードで UI のログインフォーム送信から Hydra OAuth 開始 → consent → callback → `booskiff_session` 発行 → /drive 到達までが、テストによる明示的な `/auth/oauth/start` 遷移なしに UI 導線のみで完結する
2. real E2E の enterCredentials workaround (oauth/start 明示遷移) を解除しても real suite が green (#19 の `return_to=/login` SPA 経路 workaround は維持してよい)
3. mock E2E 16 件および `bun test bff/` が無回帰
4. 導線の設計判断 (BFF 主導リダイレクトか UI 主導遷移か) とその理由が PR 本文に記録される

## In Scope

- login 成功後に OAuth 開始へ繋ぐ導線の実装 (BFF 主導リダイレクト or UI 主導遷移。判断は実装者、理由を PR に記録)
- real E2E `enterCredentials` workaround の解除
- 導線変更に対応する BFF 単体テスト / E2E 期待値の更新

## Out of Scope

- 認証ロジック自体の変更、mock モードの挙動変更
- /drive フルロード時の resume DOM 破損 (issue #19 / drive-ssr-resume-dom の担当)

## Verification

- real E2E: workaround 解除後に `scripts/e2e-real.sh` が green
- mock E2E: `scripts/e2e.sh` 16 件無回帰
- `bun test bff/` 無回帰 (導線変更分のテスト追加を含む)

## Related Links

- 元の検出記録: ShuttlePub/shuttlepub-frontends#17 (本 issue で supersede)
- 検証基盤: ShuttlePub/shuttlepub-frontends#15 / PR #18 (hydra-oidc-real-e2e)

## Base Branch Policy

- ベースブランチ: `main`。ブランチを切って実装し、PR で提出すること
