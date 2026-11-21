## Goal

`/oauth2/login`・`GET /oauth2/consent`・`POST /oauth2/consent` と、Hydra / Kratos との連携を、将来 Stellar へ移せる独立したまとまりに分ける。外から見える挙動は変えない。内訳は次のとおり。

- kernel に、challenge・consent request・検証済み session (identity id と email) などの境界型と、Hydra 管理 API 用・Kratos session 用の port を置く
- application に `service/login_consent` を置き、分岐・scope 検証・Kratos Cookie の絞り込み・結果の生成を持たせる
- driver に、Hydra 管理 API と Kratos session の client を置く
- server の route は HTTP の入出力の変換だけにし、`OAuth2Api` はユースケースだけを公開する

## Why This Slice Exists Now

決定 D52 (host: `intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md`) と D38 (同 `2026-11-18-p1-first-and-stellar-carve-out.md`) により、P1 では DCR を実装せず、既存のログイン・同意のコードをモジュールとして分けるところまでを行う。認証のまとまり (将来の Stellar) には Hydra / Kratos との連携と `/oauth2/login`・`/oauth2/consent` を置き、Emumet 本体には Account・Profile・鍵・フォロー関係・link を置く。この境界が先にコード上にないと、P1 の他の単位がログイン・同意のコードに結合していく。この単位は P1 の他の単位 (C0 など) に依存しない。

## Current Observed State

- `server/src/route/oauth2/login.rs`・`consent.rs` が `HydraAdminClient` (`server/src/hydra.rs`) と `KratosClient` (`server/src/kratos.rs`) を直接呼ぶ。skip 判定・Kratos セッション Cookie (`ory_kratos_session`) の絞り込み・scope が要求の部分集合かの検証・id_token の email claim の付与 (`build_consent_session`) も route の中にある。
- `OAuth2Api` (`server/src/api/oauth2.rs`) は `hydra_admin_client()` と `kratos_client()` で生の client を返している。
- 既存テストは `route/oauth2/login.rs` (4 件)・`consent.rs` (6 件) の `mod tests` と `route/tests.rs`。wiremock で Hydra/Kratos を模し、`AppModule::new_for_oauth2_test` と `route/oauth2/mod.rs` の `test_support::build_app` を経由する。
- 現在の挙動 (変えない): login は Hydra が skip なら Hydra の subject で accept。そうでなければ Kratos の whoami で検証し、成功なら Kratos の identity id を subject・email を context に accept。Kratos の検証が成功しない場合 (Cookie なし・`ory_kratos_session` なし・whoami が 401 または inactive・whoami の通信失敗・5xx・本文の不正を含む。`verify_kratos_session` の失敗は呼び出し側が `Err(_)` で受ける) はすべて `login_required` で Hydra login を reject して 302。502 になるのは Hydra の失敗だけ。consent は skip (Hydra または client の skip_consent) なら要求された scope・audience で accept して 302、そうでなければ `{action: show_consent, ...}` の JSON。POST は accept 時に scope が要求の部分集合でなければ 400、`consent_denied` で reject、いずれも remember=true・remember_for=3600。email claim は email scope を grant したときだけ id_token に入る。

## Accepted Baseline You May Assume

- 基準は origin/main の `1259c731af496bb09ae11286a9b869b132a88f4d` 以降の最新 main (実装開始時に取得し、PR に完全な SHA を書く)。
- 層は kernel → application → server、kernel → driver → server (`CLAUDE.md` の Architecture)。Facade (`server/src/api/`) は `DependOn*` を実装せず、route は生の port に触れない。この規約に従う。
- OpenAPI は utoipa が生成し、CI の openapi-check が `openapi.json` の差分を拒否する。`ToSchema` の型と `#[utoipa::path]` は server に残し、kernel / application / driver に utoipa を持ち込まない。
- `server/src/route/tests.rs` には `main.rs` などを文字列として検査するテストがある。`main.rs`・`root_router.rs` の構造は変えない (必要な変更は `AppModule` の組み立てだけ)。
- `HYDRA_ADMIN_URL`・`KRATOS_PUBLIC_URL` の読み方は変えない。
- JWT の検証・JWKS のキャッシュ・Account/Profile/link は Emumet 本体に残す。`KratosRegistrationFlowDirectory` と登録ゲートは login/consent の境界へ移さない。
- マージは親の指示があるまでしない。

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/src/` (login/consent の境界型と port)、`application/src/service/login_consent/`、`driver/src/` (Hydra 管理 API・Kratos session の client)、`server/src/route/oauth2/`、`server/src/api/oauth2.rs`、`server/src/handler.rs`、`server/src/hydra.rs`、`server/src/kratos.rs`、`CLAUDE.md`

Target part: login/consent と Hydra/Kratos 連携を kernel・application・driver に分け、route を入出力の変換だけにし、`OAuth2Api` をユースケースだけの公開にする。外から見える挙動は変えない。

## In Scope

- **kernel**: challenge・consent request・検証済み session などの境界型、Hydra 管理 API 用の port、Kratos session 用の port。
- **application**: `service/login_consent`。login (skip・Kratos 検証・accept・reject)、consent の取得 (skip・表示)、consent の決定 (scope 検証・accept・reject)、Cookie の絞り込み、email claim の付与。結果は「redirect する先」「同意画面を出す」「scope 不正」「上流の失敗」などの型で返す。
- **driver**: Hydra 管理 API と Kratos session の client (現在の `hydra.rs`・`kratos.rs` の login/consent 用の部分の移動)。`kratos.rs` に同居する `KratosRegistrationFlowDirectory` は移さず、触らない。
- **server**: route を、クエリ・Cookie ヘッダ・JSON の受け取りと、結果から 302 / JSON / ステータスへの変換だけにする。`OAuth2Api` はユースケースだけを公開し、生の hydra / kratos client を返す accessor をなくす。`AppModule` は新しい port の配線だけ直す。
- **テスト**: 既存テストを変更せずに通す。DB を使わないユースケースのテスト (port を fake にする) と、Ory のエラーごとのテストを追加する。
- **文書**: `CLAUDE.md` の Architecture / Auth Architecture / Server DI Architecture の OAuth2 関連の記述を、新しい境界に合わせて直す。

## Out Of Scope

- 他の P1 単位 (C0・K1・L1・Q1・S1・I1・B1・T1)。
- DCR (動的クライアント登録)、client_id と origin の対応表、Stellar の実際の切り出し。
- JWT 検証・JWKS キャッシュ・Account/Profile/link の変更、`KratosRegistrationFlowDirectory` と登録ゲートの移動。
- DB マイグレーション、新しい永続化、新しい環境変数、新しい route、OpenAPI の変更。
- k8s・Ory の設定ファイル・frontends・共通 workflows。
- マージ。範囲が広がる・制約と矛盾する場合は止めて報告する。

## Standalone Child Issue Contract

この PR は、`/oauth2/login`・`GET/POST /oauth2/consent` と Hydra/Kratos との連携を、kernel (境界型と port)・application (`service/login_consent`)・driver (Hydra 管理 API と Kratos session の client) に分け、server の route を入出力の変換だけ、`OAuth2Api` をユースケースだけの公開にする。外から見える挙動 (URL・302 の Location・JSON・scope・audience・remember・email claim・subject・Kratos セッション Cookie だけを渡すこと・エラー対応) は変えず、既存の route テストを無変更で通す。DB を使わないユースケースのテストと Ory のエラーごとのテストを追加する。JWT 検証・JWKS・Account/Profile/link・登録ゲートは本体に残し、DCR・対応表・DB マイグレーションは追加しない。マージはしない。

## Acceptance Criteria

- A1-1 外から見える挙動: `GET /oauth2/login`・`GET /oauth2/consent`・`POST /oauth2/consent` の URL・メソッド・ステータス・302 の Location・JSON 本文 (`action`: `redirect` / `show_consent`)・grant する scope・audience・remember (true)・remember_for (3600 秒)・id_token の email claim (email scope を grant したときだけ・Hydra の context にある email のみ)・login の subject (skip 時は Hydra の subject、通常は Kratos の identity id)・login の context.email が、すべて現在と同じ。
- A1-2 Cookie: Kratos へ渡すのは `ory_kratos_session=...` の Cookie だけ。他の Cookie は渡さない。Cookie ヘッダなし・`ory_kratos_session` なし・whoami が 401 または inactive・whoami の通信失敗・5xx・本文の不正は、いずれも Hydra の login reject (`login_required`) にして、その `redirect_to` へ 302 する。
- A1-3 エラー: Kratos の検証が成功しないとき (Cookie なし・whoami が 401 または inactive・whoami の通信失敗・5xx・本文の不正など、検証の失敗はすべて) は Hydra の login reject (`login_required`) にして 302 する (502 にしない。現行コードの `verify_kratos_session` の失敗を `Err(_)` で受けて reject する分岐を正とする)。502 になるのは Hydra の失敗 (login の取得・accept・reject、consent の取得・accept・reject) だけ。POST で要求されていない scope を grant しようとしたら 400。`accept=false` は `consent_denied` で reject。
- A1-4 テスト: 既存の route テスト (`route/oauth2/login.rs`・`consent.rs` の `mod tests`、`route/tests.rs`) をテスト関数本体と期待値を変更せずに通す (配線の補助を調整する必要が出たら理由を PR 本文に書き、アサーションは変えない)。追加: (a) DB を使わず port を fake にしたユースケースのテスト (login の skip・有効セッション・Cookie なし・無効セッション・email なし、consent の skip・client skip・表示・accept・scope 超過・reject、email claim の付与条件)、(b) driver の Hydra 管理 API client と Kratos session client の Ory のエラー別のテスト (Hydra の 4xx/5xx、Kratos の 401・inactive・5xx・本文の不正・通信失敗など) と、それがユースケースの結果 (Kratos の失敗はすべて login reject、Hydra の失敗は 502) へ届くことの確認。
- A1-5 境界: kernel に境界型と port、application に `service/login_consent`、driver に client。route は入出力の変換だけで、`OAuth2Api` はユースケースだけを公開する (生の hydra / kratos client を返す accessor を残さない)。
- A1-6 本体に残すもの: JWT 検証・JWKS キャッシュ・Account/Profile/link は移さない。`KratosRegistrationFlowDirectory` と登録ゲートは移さず、触らない。
- A1-7 追加しないもの: DCR・client_id と origin の対応表・新しい永続化・新しい環境変数・新しい route・OpenAPI の変更。DB マイグレーションは追加しない。秘密 (Cookie・challenge 以外のトークン) を新たにログへ出さない。
- A1-8 生成物と CI: `openapi.json` の差分なし (`cargo test -p server write_openapi_spec_to_file -- --ignored` の後に `git diff --exit-code openapi.json`)。CI (lint-and-test の fmt・clippy・test・openapi-check と e2e) がすべて緑。
- A1-9 独立性: login/consent の kernel 型・port・application service・driver client は、Account・Profile・link・AuthAccount・DB の型や port に依存しない (依存してよいのは kernel の共通 error 型などの基盤だけ)。依存方向の確認方法 (例: import の grep) と結果を PR 本文に残す。
- A1-10 範囲: 他の P1 単位に依存せず、その範囲を実装しない。変更は Target paths の範囲に限る。
- PR CI がすべて緑で、PR は未マージ。PR 本文に、基準の完全な SHA、A1-1〜A1-10 の検証結果、依存方向の確認方法と結果、既存テストを無変更で通した結果、未検証の範囲を書く。

## Verification

`cargo fmt --check`、`cargo clippy --workspace --all-targets -- -D warnings`、`cargo test --workspace` (DB テストを含む)、`cargo test -p server write_openapi_spec_to_file -- --ignored` の後の `git diff --exit-code openapi.json`、`git diff --check`、PR CI (lint-and-test・e2e) 全緑。

## Related Links

- 決定: host の `intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md` (D52)、`2026-11-18-p1-first-and-stellar-carve-out.md` (D38)、`intents/emumet/decisions/0001-stellar-frozen-ory-authz.md`。
- 参照: `server/src/route/oauth2/`、`server/src/api/oauth2.rs`、`server/src/hydra.rs`、`server/src/kratos.rs`、`server/src/handler.rs` (`new_for_oauth2_test`)、`server/src/route/tests.rs`、`.github/workflows/lint-and-test.yml` (openapi-check)。
- 後続: DCR と対応表の担当は P1 の後の Stellar の設計で決める (D52)。

## Knowledge Maintenance

- Intent placement: `intents/emumet/intent-tree/00-map.md` (新規ノードは不要。D52/D38 の規則をコード構造にする作業)
- ADR candidate: none
- Diagram candidate: none
- Docs update: Emumet の `CLAUDE.md` の OAuth2 / DI 関連の記述 (この PR で)
- Closeout writeback expected: no

## Guide Reachability (G645)

この slice は運用者・role 向けの新しい surface を追加しない (no role-facing surface)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.

## Additional Required Guidance

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。child は host 側の packet / intent / queue / ラベルを調査・変更しない。Emumet 側に親状態を作らない。
- ラベルを手で編集しない。`worker claim` が使えない場合は実装担当ではなくリードが claim を扱う。
- 親の指示なしにマージしない。
