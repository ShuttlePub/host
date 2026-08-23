# OAuth2 明示同意画面 (BFF standalone HTML ページ + i18n スコープラベル)

## Goal

Ratcap BFF (`index.ts`) に `GET /oauth2/consent` / `POST /oauth2/consent` を追加し、
Hydra の手動同意 (manual consent) フローで、ユーザーがクライアント名と要求スコープを
確認して許可/拒否できる standalone HTML ページを提供する。スコープは日本語プライマリの
ラベルマップ (i18n 構造・英語も出力可能) で表示し、言語は `Accept-Language` ヘッダから
サーバーサイド判定する。Flame SSR / PureScript 側には一切触れず、BFF 層のみで完結させる。

## Why This Slice Exists Now

ShuttlePub は Emumet をリソースサーバーとして利用し、公式以外の**外部 ShuttlePub
ホスト**もサードパーティ OAuth2 クライアントとして登録・利用する見込み
(2026-08-11 オペレーター決定 D7)。外部クライアントに対して consent の auto-skip は
不適切で、明示的な同意画面が必須となる。ratcap backlog の Ready 先頭として
2026-08-24 grill で設計を確定し、packet 化した。

## Current Observed State

- Emumet には `GET /oauth2/consent` / `POST /oauth2/consent` が実装済み
  (`server/src/route/oauth2/consent.rs`)。challenge ベースの非認証 API で、
  非 skip クライアントには `ShowConsent { consent_challenge, client_name,
  requested_scope }` を JSON 返却、skip 対象では accept して 302 を返す。
- Ratcap には consent ページが存在しない。Hydra の consent URL は現在 Emumet
  `/oauth2/consent` を向いており、Emumet は非 skip 時の同意 UI を持たないため、
  手動同意が要求されるとフローが完結できない。
- Ratcap BFF (`index.ts`) は `/auth/*` (login / oauth/start / callback / session /
  logout) をサーバーサイドで処理する既存パターンを持つ。

## Accepted Baseline You May Assume

- 設計判断は `intents/ratcap/features/oauth2-consent/decisions.md` D1-D10 に確定済み。
  特に D8 (BFF 素 HTML standalone ページ) / D9 (ja-primary i18n、Accept-Language 判定、
  未知スコープは生名フォールバック) / D10 (`ratcap_session` 不要求・challenge のみで動作、
  不正時はエラーページ)。
- 同意画面は Hydra ログイン完了後にのみ到達する。第三者クライアント経由のユーザーは
  Ratcap セッションを持たないため、本ページはセッション cookie を要求してはならない。
- 拒否時は追加の誘導を行わず、`accept: false` に対する Hydra の 302
  (`error=access_denied` 付きクライアント redirect_uri) にそのまま従う (D3)。
- mock 認証モードでは本機能は無効・スキップでよい (D5)。
- 見た目の統一は既存 CSS の読み込みで担保する (SPA ハイドレーションは不要、D8)。

## Target Repo / Path / Part

Repository: `ShuttlePub/RatCap`

Target paths: `index.ts`, `bff/server.test.ts` (または新規 consent テストファイル),
デプロイ設定 (Hydra consent URL の Ratcap 向け変更、D6)

Target part: BFF の `/auth/*` と同じ層に追加する consent GET/POST ハンドラ

## In Scope

- `GET /oauth2/consent?consent_challenge=...` ハンドラ: Emumet `GET /oauth2/consent` を
  サーバーサイドで呼び、`ShowConsent` 応答なら同意フォーム HTML を描画、302 応答
  (auto-skip) ならそのままリダイレクトを伝搬する。
- 同意フォーム: `client_name` と `requested_scope` の一覧を表示。スコープは i18n
  ラベルマップ (言語コード → スコープ → ラベル) 経由で日本語プライマリ表示、
  `Accept-Language: en` では英語、未知スコープは生名フォールバック。
  `consent_challenge` は hidden フィールドまたはクエリで POST に引き継ぐ。
- `POST /oauth2/consent` ハンドラ: 許可 (`accept: true` + `grant_scope:
  requested_scope`) / 拒否 (`accept: false`、`grant_scope` なし) を Emumet へ中継し、
  返された 302 `Location` へそのままリダイレクトする。
- challenge 欠落・不正時 (Hydra 照会失敗) のエラーページ。
- BFF 単体テスト (Emumet 呼び出しを mock 化): show_consent 描画 / auto-skip 302 伝搬 /
  許可・拒否の中継 / 不正 challenge / Accept-Language による言語切替。
- Hydra consent URL を Ratcap `/oauth2/consent` に向けるデプロイ設定変更 (D6)。

## Out Of Scope

- Flame SSR ルート・`Route.purs` / `Server.purs` / `src/Generated/` 等 PureScript 側の変更。
- `ratcap_session` との連携・ログイン画面への誘導。
- mock 認証モードでの consent 動作 (D5)。
- Emumet 側の変更 (API は実装済み)。
- 既存 `/auth/*` フロー・`/auth/callback` の変更。

## Standalone Child Issue Contract

Ratcap BFF に `GET/POST /oauth2/consent` を素の HTML ページとして実装し、Hydra 手動同意
フローを完結させる。GET は Emumet の consent API から `client_name` / `requested_scope`
を取得してフォームを描画し (auto-skip 時は 302 伝搬)、POST は許可/拒否を Emumet へ中継
して 302 に従う。スコープ表示は日本語プライマリの i18n ラベルマップとし、言語は
`Accept-Language` から判定、未知スコープは生名フォールバック。セッション cookie は
要求せず、challenge 不正時はエラーページを表示する。変更は `index.ts` と BFF テストに
閉じ、PureScript 側・既存 `/auth/*` には触れない。Hydra consent URL の Ratcap 向け
設定変更を成果物に含める。

## Acceptance Criteria

- `GET /oauth2/consent?consent_challenge=...` で `ShowConsent` 応答時に HTML 同意
  ページが表示される。
- 同意ページに `client_name` とスコープ一覧がラベル表示され、未知スコープは生名で
  フォールバックする。
- `Accept-Language: ja` で日本語、`en` で英語ラベルが返る。
- 同意ページの取得・送信が `ratcap_session` cookie なしで完結する。
- 「許可」で `accept: true` + `grant_scope` が送信され 302 `Location` へ遷移する。
- 「拒否」で `accept: false` (`grant_scope` なし) が送信され 302 `Location` へ遷移する。
- auto-skip 時は同意ページを生成せず 302 を伝搬する。
- challenge 欠落・不正時にエラーページが表示される。
- 既存 `/auth/*` フローにリグレッションがない (`bun test` 全件 pass)。
- real モードで Hydra の consent skip を無効化し、手動同意フローが完結することを
  手動 E2E で確認する。

## Verification

- `bun test` (BFF 単体テスト、Emumet 呼び出し mock) が全件成功。
- real モード手動 E2E: 第三者クライアント相当の認可フローで同意画面表示 → 許可/拒否 →
  クライアントへのリダイレクト完了を確認。
- `git diff --check`。

## Related Links

- Intent: `intents/ratcap/features/oauth2-consent/` (decisions.md D1-D10)
- Grill 記録: `intents/ratcap/interview/2026-08-24-oauth2-consent-flow-grill.md`
- Emumet 側実装: `server/src/route/oauth2/consent.rs` (ShuttlePub/Emumet)

## Knowledge Maintenance

- Intent placement: `intents/ratcap/features/oauth2-consent/` (既存ノード、新規不要)
- ADR candidate: none (feature レベルの decisions.md に記録済み)
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes — 完了時に `packets/backlog.md` の完了セクション移動と
  `features/oauth2-consent/packets.md` への issue リンク追記 (host-only)

## Guide Reachability (G645)

- guide_surface: guide workflow task implementation-loop
- role: implementation
- target_surface: Ratcap BFF `GET/POST /oauth2/consent` (同意フォーム HTML + Emumet 中継)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
