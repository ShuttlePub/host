## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。shuttlepub-frontends 側の旧 design-host 記述や child 側の文書を根拠に、child (shuttlepub-frontends) へ親状態 (packet・intent・queue・ラベル) を作成・変更しない。

## Goal

emumet-web の Account 作成に別入力の Profile username を追加し、変更不可の説明と、既存 Profile への一回限り設定を提供する。BFF・GraphQL・モック・identity 表示を更新し、新 UI は作成時に username を必ず送る。画面構成を決める UI 実装はモック合意の記録まで保留し、BFF・GraphQL・REST 変換・モック・生成型・fixture など画面に依存しない部分を先行する。

## Why This Slice Exists Now

P4 (in-place cutover) が username を必須化する前に、既存の作成導線と既存 Profile の未設定状態を解消しておく必要があるため (P4 は FN の merge と全既存 Profile の username 設定確認が前提)。Profile 単位 identity (acct の名前部分) をユーザーが自分で決められる入口を emumet-web に用意する。

## Current Observed State

- emumet-web の Account 作成 (CreateAccountInput {name, isBot}) は username を送らず、Profile (GraphQL) は username を持たない。identity 表示は Account 名中心
- Emumet 側: E8 で username の段階契約 (optional・400/501・nullable) が確定済みで、P1 (Emumet#71) が実保存と一回限り設定を実装予定 (実装前)
- 画面構成 (作成フォーム内の username 入力・変更不可の説明・一回限り設定の配置) はモック (lead thread thread-xxs52dcx の artifact-62a146ec3345a2f3f6e2f4537b728c72) をユーザーがレビュー中で未合意
- bff/schema.graphql は別レーン F15 (registration-gate-admin-ui) も更新する共有ファイルで、F15 の BFF 部分は merge 済み・画面部分はモック合意待ち

## Accepted Baseline You May Assume

- 【画面実装ゲート】画面構成 (Account 作成フォーム内の username 入力の配置・変更不可の説明・既存 Profile への一回限り設定画面の配置・文言・見た目) は、リード側モック (lead thread thread-xxs52dcx の artifact-62a146ec3345a2f3f6e2f4537b728c72) へのユーザー合意が host intent (intents/emumet/features/profile-federation/ 配下) に記録されるまで確定していない。**この合意が host intent に記録されるまで画面実装 PR (PureScript の View/画面・ルート・CSS・visual baseline を追加・変更する PR) を出さない**。合意の記録は host 側 issue コメント/依頼で child に伝達される。BFF・GraphQL・REST 変換・モック・生成型・fixture など画面構成に依存しない部分は先行して PR を出してよい (その PR に画面実装を混ぜない)
- 機能の正本は Emumet 側 (domain emumet、feature PF = intents/emumet/features/profile-federation/)。target が frontends でも ratcap domain の unit ではない。ratcap の settings-hub / intent map (intents/ratcap/intent-tree/00-map.md) は参照リンクのみ (host 側で追加済み/追加予定)。過去の ratcap packet は書き換えない
- 依存 API: E8 (Emumet#66 / PR #70、マージ済み・squash 0bfa437) の契約と、P1 profile-actor-identity-foundation (Emumet#71) の実装。E8 確定契約: POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username は optional (null は省略扱い)、形式・予約語違反は 400 (作成副作用前)、P1 実装前の有効値は 501、ProfileResponse.username は nullable (未設定を表現可能)。username 更新 API は存在せず、通常の編集機能として設けない。既存 Profile の一回限り設定の endpoint・競合 (重複) 時のエラー・未設定時の読取形は P1 が確定する。契約の正本は Emumet#71 の issue/PR と生成 openapi.json。P1 未 merge の間は issue/PR の契約に合わせた stateful mock で進め、契約が曖昧・不整合なら実装を進めず issue で質問する (勝手に拡張しない)
- username 仕様 (E8 で確定): 形式 ^[a-z0-9][a-z0-9._-]{0,63}$ (ASCII 小文字 1〜64 文字)、暗黙の trim・小文字化なし。予約語 admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known。DB 一意・削除済み再利用なし・Account 名から自動導出しない。段階: E8/P1〜P3 optional → FN で UI 必須送信 → P4 で required
- username の段階 (E8/P1〜P3 optional → FN → P4 required): 本 unit は『新 UI は作成時に username を必ず送る』段階で、API が optional の間も新 UI は必須入力として扱う。username を省略する旧経路 (既存の Account 作成導線) は本 unit で置き換える。P4 の前提は本 unit の merge (モック合意後の画面実装を含む) と P1 との実接続確認。P4 の required 化に依存しない
- username は Account 名から自動導出しない。Account 名とは別入力で、一度設定したら変更できない (変更 UI・変更 mutation を作らない)。Profile を組織へ移管 (Emumet 側で実装済みの Profile 移管) しても username は変わらず、emumet-web の identity 表示は username を Profile の属性として表示し、Account 名や移管先 Account から導出しない
- 既存の BFF 構造 (apps/emumet-web/AGENTS.md): bff/schema.graphql が data API の SDL の正本、bff/emumet/{client.ts,real.ts,mock.ts} が Emumet クライアント契約 (snake_case ↔ camelCase 変換は real.ts)、bff/resolvers.ts、bff/loaders.ts、bff/context.ts。PureScript 型は scripts/sync-graphql.ts で bff/schema.graphql から生成 (src/Generated/ は手編集禁止)。現状の GraphQL は CreateAccountInput {name, isBot} と Profile {nanoid, accountId, displayName, summary, iconUrl, bannerUrl} で username を持たない
- 【統合の直列化】bff/schema.graphql と生成型 (src/Generated/**) の変更は別レーン F15 (registration-gate-admin-ui、shuttlepub-frontends#31) と直列に統合する (同時に別ブランチで更新して衝突させない。main の最新から生成し直す)。F15 の BFF 部分 (PR #33) は merge 済みで、画面部分はモック合意待ち。workspace・CI・visual 共通基盤は別レーン F0 が所有し、本 unit はそれらを変更しない (既存の visual 登録経路へ画面/fixture を追加するのみ)。生成物 (src/Generated/**、OpenAPI 由来型) の手編集は禁止
- username の重複・予約語・形式違反・未設定・変更禁止はそれぞれ別の状態/エラーとして扱い (409 重複、400 形式・予約語、未設定は null、変更禁止は設定済み Profile への再設定拒否)、BFF/UI で混同しない。サーバー応答の 400/409/401/403 を握りつぶさず、認可の正本は Emumet API とする

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`
Path: apps/emumet-web/bff, apps/emumet-web/src, apps/emumet-web/test
Part: emumet-web の Profile username 対応: BFF (Emumet REST 変換・GraphQL スキーマ・mock/real クライアント) + 生成型 + fixture を先行し、画面構成 (作成フォームの username 入力・変更不可の説明・既存 Profile への一回限り設定・identity 表示) はモック合意の記録後に実装

## In Scope

- 【先行可・画面非依存】GraphQL (CreateAccountInput の username、Profile の username、既存 Profile への一回限り設定 mutation)・EmumetClient の client.ts / real.ts (snake_case ↔ camelCase、profile_username・username) / mock.ts (重複・予約語・一回限り・移管不変を再現する stateful mock)・resolvers・生成型・fixture・BFF テスト
- 【先行可・画面非依存】P1 の実 API との実接続確認 (P1 マージ後)
- 【モック合意後・画面】Account 作成フォームの別入力 username・変更不可の説明、既存 Profile への一回限り設定の UI、重複・予約語・未設定・変更禁止の表示、identity 表示の更新、SSR/hydration・visual

## Out Of Scope

- username の変更 (変更 UI・変更 mutation・変更 API)
- 新しい組織管理画面一式、Profile 移管 UI の新設
- モック合意前の画面実装 (PureScript の View・画面・ルート・CSS・visual baseline の追加・変更)
- workspace・CI・visual 共通基盤の変更 (F0 の所有)、shuttlepub-web (SNS アプリ) 側の変更
- Emumet 側の実装 (P1)、P4 の username 必須化・切替
- bff/schema.graphql・生成型の F15 との並行更新 (直列に統合する)

## Standalone Child Issue Contract

emumet-web の Account 作成に別入力の Profile username を追加し、変更不可の説明と、既存 Profile への一回限り設定を提供する。BFF・GraphQL・モック・identity 表示を更新し、新 UI は作成時に username を必ず送る。画面構成を決める UI 実装はモック合意の記録まで保留し、BFF・GraphQL・REST 変換・モック・生成型・fixture など画面に依存しない部分を先行する。 host の packet・intent・queue・ラベルは調査・変更しない (親が行う)。 受け入れ条件と検証は下記のとおり。

## Acceptance Criteria

1. 【先行可】BFF: GraphQL (bff/schema.graphql) の CreateAccountInput と EmumetClient (client.ts / real.ts REST 変換 / mock.ts stateful mock) が username を扱い、作成時に profile_username として必ず Emumet へ送る。Profile の username (nullable) を読み取り、既存 Profile への一回限り設定の mutation が揃う。生成型が sync-graphql で再現可能に更新され、再生成差分が空である。省略 (username なし) の作成 mutation は新 UI から呼ばれない
2. 【先行可】エラーの区別: 重複 (409)・予約語/形式違反 (400)・未設定 (null)・変更禁止 (設定済みへの再設定拒否)・未認証/権限なし (401/403) が BFF で別の型/エラーコードになり混同されない。real.ts の REST 変換テスト、mock の stateful 挙動 (重複・予約語・一回限り) が E8/P1 契約に照合される
3. 【先行可】P1 の実 API との実接続: 実 Emumet (P1 マージ後) に対し Account 作成時の username 保存、既存 Profile への一回限り設定、重複・予約語・変更禁止の応答を BFF 経由で確認する (P1 未 merge の間は mock で先行し、実接続確認は P1 マージ後に必須)
4. 【先行可】移管しても username が変わらない: Profile を移管した後も BFF が返す username が不変で、identity 表示が Account 名・移管先から導出されないことを BFF テスト (実接続または契約 fixture) で確認する
5. 【モック合意後】新 UI は Account 作成時に username を別入力で必ず送る (未入力は送信不可)。『変更不可』の説明が表示され、画面構成・文言はモック合意に従う (説明を増やしすぎない)。合意前は画面実装 PR を出さない
6. 【モック合意後】既存 Profile (username 未設定) に一回限りの設定ができ、設定後は変更できない状態として表示される。重複・予約語・形式違反・未設定・変更禁止が区別して表示される。identity 表示が username を使う
7. 【モック合意後】SSR/hydration (全状態 fixture で DOM 破損・不一致がない)、visual (mobile/desktop、作成・未設定・設定済み・各エラー) が既存の visual 経路で通る。生成物は手編集されず、sync-graphql の再生成差分が空である
8. 既存の emumet-web 画面・BFF の挙動 (ログイン、アカウント一覧/詳細、moderation、登録ゲート管理 BFF) は変更されない。username の変更機能・新しい組織管理画面一式は作らない

## Verification

BFF テスト (bun test): REST 変換 (real.test.ts)、stateful mock、resolver、エラー区別。GraphQL 生成 (bun scripts/sync-graphql.ts の再生成差分が空)。画面実装 (モック合意後) の SSR/hydration (全状態 fixture) と既存 visual 経路での visual (mobile/desktop)。P1 マージ後の実 Emumet との実接続確認 (Account 作成時の保存・一回限り設定・重複/予約語/変更禁止・移管後の不変)。既存 PureScript テスト (spago test) と git diff --check。

## Related Links

- host: intents/emumet/features/profile-federation/ (primary)、intents/emumet/features/personal-domain-controls/、intents/shuttlepub/packets/candidates.md (D08)
- Emumet ADR 0007、E8: Emumet#66 / PR #70、P1: Emumet#71、F15: shuttlepub-frontends#31、モック: thread-xxs52dcx の artifact-62a146ec3345a2f3f6e2f4537b728c72

## Dependencies

profile-actor-identity-foundation

## Merge Order

E8 (Emumet#66 / PR #70) はマージ済み。BFF 部分は P1 (Emumet#71) の契約に合わせて先行可。P1 との実接続確認は P1 のマージ後。画面実装はモック合意の host 記録後。bff/schema.graphql・src/Generated/** の変更は F15 (shuttlepub-frontends#31) と直列に統合する。P4 (profile-federation-in-place-cutover) は本 unit の merge (画面実装を含む) を前提とするが、本 unit は P4 に依存しない。

## Knowledge Maintenance

- Intent placement: host の `intents/emumet/features/profile-federation/overview.md (primary)。supporting: intents/emumet/features/personal-domain-controls/overview.md、intents/ratcap/features/settings-hub/overview.md、intents/shuttlepub/packets/candidates.md ほか`
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: FN の BFF/GraphQL の確定形、username 関連のエラー区別、画面実装ゲートとモック合意の記録、検証境界を PF acceptance.md に記録する (host 側 closeout writeback) (host 側。host 更新は親が行う)
- Closeout writeback expected: yes — 確定した BFF/GraphQL の形、username 関連エラーの区別、fixture の一覧、画面構成のモック合意内容 (host intent 側)、P1 との実接続結果、visual の登録内容

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → emumet-web Account 作成・Profile username 設定 (BFF GraphQL: bff/schema.graphql。画面は合意後)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
