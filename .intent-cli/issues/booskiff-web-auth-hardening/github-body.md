## Goal

booskiff-web の real 認証に残る 2 つのリスクを修正する: (1) 同名 cookie のうち最初の値を採用する共有 cookie 処理、(2) 認可要求に `prompt=login` がなく Hydra の remembered login session で A→logout→B が A として認証され得ること。

## Why This Slice Exists Now

shuttlepub-web の Hydra OIDC 認証 (PR #32/#41) のレビューで見つかった同種の不備が shuttlepub-web 側だけで修正され、共有 auth パッケージと booskiff-web には未修正で残っている。

## Current Observed State

- `packages/auth-core/src/cookie-header.ts` の `parseCookieValue` は同名 cookie の最初の値を採用する。session / OAuth state (PKCE) cookie の読取に使われ、兄弟 Domain 等から注入された同名 cookie で差し替えられ得る
- `packages/auth-bun/src/cookie-jar.ts` の `CookieJar.mergeBrowserCookies` は同名 `ory_kratos*` の最初の値を採用し、`apps/booskiff-web/bff/auth-real.ts` の logout は `ory_kratos*` を重複のまま Kratos へ転送する
- `startRealOAuth` の認可 URL に `prompt` がなく、logout は revoke と Kratos logout のみ。provider が remember:true で accept する構成では、A→logout→B で Hydra が remembered subject (A) を skip 承認する

## Accepted Baseline You May Assume

- shuttlepub-web の対処 (`apps/shuttlepub-web/bff/auth.ts` の `uniqueAuthCookie` と `prompt=login`、e2e の A→logout→B テスト) が参照実装
- `apps/booskiff-web/e2e/real/provider.ts` は `PROVIDER_REMEMBER_LOGIN=true` で remembered skip 分岐を再現できる (PR #32 で追加)
- real E2E 基盤 (#15 / PR #18)、ログイン導線 (#20 / PR #22) は main にマージ済み
- mock モードの挙動は変えない

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `packages/auth-core`, `packages/auth-bun`, `apps/booskiff-web/bff`, `apps/booskiff-web/e2e/real`, `apps/booskiff-web/e2e/compose.e2e.real.yml`

Target part: 同名 cookie の曖昧受理の排除と、real 認可要求への `prompt=login` 付与 (A→logout→B 回帰の固定)

## In Scope

- `parseCookieValue`: 同名 cookie が複数あれば null (fail-closed)
- `CookieJar.mergeBrowserCookies`: 同名 `ory_kratos*` が複数ある名前はドロップ。logout の Kratos cookie 転送を CookieJar 経由に統一
- `startRealOAuth` に `prompt=login`
- 回帰テスト (bun test) と real E2E (A→logout→B、remember 有効 provider、2 人目の seed)

## Out Of Scope

- RP-initiated logout (id_token_hint + Hydra `/oauth2/sessions/logout`): AppSession が id_token を保持せず Hydra logout UI の設定・ブラウザ遷移を要するため実装しない。`prompt=login` で毎回現在の Kratos identity を再確認させる。Hydra 側の remembered cookie が有効期限まで残る点は残余リスクとして PR に記録する
- emumet-web への `prompt=login` 付与、`__Host-` cookie プレフィックス、OIDC nonce 検証 (別 unit 候補)
- 認証ロジックのその他の変更

## Standalone Child Issue Contract

booskiff-web の real 認証が (a) 同名 cookie を曖昧に受理せず fail-closed にし、(b) 認可要求に `prompt=login` を付けて A→logout→B で B として認証されるようにする PR を提出する。共有 auth-core / auth-bun の変更は emumet-web / shuttlepub-web に回帰を起こさないこと。real E2E はローカル実行できなければ未実行と PR に明記する。

## Acceptance Criteria

1. 共有 `parseCookieValue` は同名 cookie が複数あれば null を返す。単一 cookie の既存動作は不変
2. `CookieJar.mergeBrowserCookies` は同名 `ory_kratos*` が複数ある名前を転送せず、logout の Kratos cookie 転送も同じ規則
3. `startRealOAuth` の認可 URL に `prompt=login` が付く (mock は不変)
4. 回帰テスト: 同名 cookie (session / oauth state / ory_kratos)、`prompt=login` の認可 URL、重複 oauth cookie の callback が `invalid_state`
5. real E2E に A→logout→B (remember 有効 provider、prompt を外した対照は A) を追加。ローカル未実行なら PR に明記
6. 既存の bun test (booskiff-web bff / auth-bun / emumet-web / shuttlepub-web)・tsc・mock E2E の回帰なし。RP-initiated logout 不採用の残余リスクが PR に記録される

## Verification

- `bun test` (apps/booskiff-web bff、packages/auth-bun、apps/emumet-web、apps/shuttlepub-web)、`bunx tsc --noEmit`、`git diff --check`
- mock / real E2E は secret・Docker 不在なら未実行と明記

## Related Links

- 参照実装: ShuttlePub/shuttlepub-frontends PR #32 / #41 (apps/shuttlepub-web/bff/auth.ts)
- 検証基盤: #15 / PR #18、導線: #20 / PR #22

## Knowledge Maintenance

- Intent placement: intents/ratcap/intent-tree/00-map.md (新規ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: none (e2e README の追記のみ任意)
- Closeout writeback expected: no

## Guide Reachability (G645)

guide workflow task implementation-loop / role implementation / target ShuttlePub/shuttlepub-frontends。role-facing の新規 surface は追加しない。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
