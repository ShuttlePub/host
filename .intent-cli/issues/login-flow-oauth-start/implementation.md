# login-flow-oauth-start Implementation Packet

## Goal

booskiff-web の real モード (USE_MOCK=false) で、ログインフォーム送信 (Kratos 資格情報認証) の成功後に Hydra OAuth 開始 (`/auth/oauth/start`) までが UI 導線として自動的に完結するようにする。現状は login 成功がそのまま `SessionChecked` にマップされ、PKCE フローが開始されないため `booskiff_session` が発行されず、/drive で API 401 となる (shuttlepub-frontends#17)。

## Why

hydra-oidc-real-e2e (issue #15 / PR #18) で real モード E2E 基盤が整い、実検証でこの導線断絶が確定的に再現した。E2E は `/auth/oauth/start` への明示遷移で回避しているが、これは「途切れない UI ログイン導線」の保証にならない。real モードを実運用可能にするには導線修正が必須。

## Scope

- login 成功後に OAuth 開始へ繋ぐ導線の実装。設計候補:
  - (a) BFF 主導: real モードの `POST /auth/login` 成功レスポンスを 302 `/auth/oauth/start` にする (UI 変更不要・モード判定不要)
  - (b) UI 主導: login 成功後にクライアントが `/auth/oauth/start` へ遷移する (モード判定経路が必要)
  - 判断と理由は PR 本文に記録すること
- real E2E (`apps/booskiff-web/e2e/real/tests/auth.spec.ts`) の `enterCredentials` workaround (oauth/start 明示遷移) の解除
- 導線変更に対応する BFF 単体テスト / E2E 期待値の更新

## Out of scope

- 認証ロジック自体の変更 (id_token 検証・セッション seal・CSRF 等は PR #14 の状態を維持)
- mock モードの挙動変更 (mockLogin の直接セッション発行はそのまま)
- /drive フルロード時の resume DOM 破損 (drive-ssr-resume-dom / issue #19 の担当。E2E の `return_to=/login` SPA 経路 workaround は維持)

## Verification

- real E2E: workaround 解除後に `scripts/e2e-real.sh` が green (happy path が UI 導線のみで完走)
- mock E2E: `scripts/e2e.sh` 16 件無回帰
- `bun test bff/` 97 件以上で無回帰 (導線変更分のテスト追加を含む)
