## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。

## Goal

shuttlepub-web に、利用者が自分の Profile の domain mute/block を設定・確認・解除する UI を実装する。解除してもブロックで解除した関係は復元されないことを説明し、FA 経由の実 Emumet に接続して実方針保存・取得・Follow 解除までを確認する。投稿表示面 (引用・boost 全体非表示、単一投稿 reveal) は S8 準拠の mock とし、投稿側の抑制・反応拒否は未実装なので mock/未接続と明示する。画面構成を決める実装はモック合意後。

## Why This Slice Exists Now

D08 の利用者向け操作面。Emumet 側 (D8P/D8G/D8R) の Follow 制御と、ShuttlePub 側 (S8 契約、後続の実処理) の投稿制御の現在地を利用者に誤解なく見せる必要がある。実接続の最終受け入れは D8R の後、モック先行部分は E8/S8 確定後に進められる。

## Current Observed State

- F0 (apps/shuttlepub-web の基盤) と FA (認証フロー/BFF、PR #32) はマージ済み。ログイン画面を含む画面実装はモック合意後
- E8 はマージ済みで domain-controls の契約がある。D8P は保存を実装済みだが route は本番未 mount、D8G・D8R・P4 は未着手/未マージ
- S8 (投稿抑制の API 契約) は別レーンで未登録。投稿の実抑制・反応拒否は未実装 (後続 unit)
- D08 の画面モックは合意前 (host intent に合意記録なし)

## Accepted Baseline You May Assume

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。
- F0 (shuttlepub-web-foundation) の apps/shuttlepub-web・OpenAPI 取込基盤・BFF と、FA (shuttlepub-web-emumet-auth、PR #32 マージ済み) の Hydra OIDC 認証・HttpOnly session・Emumet Bearer 転送 (audience=account)・認証済み Profile 選択の上に実装する。新しい認証方式は作らない
- Emumet の契約: E8 (Emumet#66 / PR #70) の domain-controls (GET /api/v1/profiles/{profile_nanoid}/domain-controls、GET/PUT/DELETE .../{domain})。revision は 1 始まり、PUT は expected_revision 省略で新規 (既存なら 409)・指定時は一致のみ置換 (不一致・同時削除は 409)、DELETE は expected_revision 必須、不正 domain は 422 (D8P で 400 から変更)、所有者のみ (401/403/404)。domain は完全一致で、応答の domain は常に正規化形 (IDNA 等)。詳細は host の DC acceptance.md の『E8 確定契約』『D8P 確定契約』
- Emumet の実処理: D8P は保存を実装済みだが domain-controls route は本番未 mount。block の関係解除は D8R、Follow の拒否は D8G、本番 mount は P4 マージ後の D8R。したがって実 Emumet 接続の最終受け入れは D8R のマージ後。それ以前は E8/D8P 契約準拠の stateful mock で先行する
- D08 の区分: Follow 制御 (新規 Follow 拒否・既存関係の両方向解除) だけが Emumet で実適用される。投稿の抑制 (timeline・検索・通知の表示抑制、引用・boost 全体非表示、単一投稿 reveal) と新規反応・返信・引用・リポストの受理/送信拒否は ShuttlePub の後続責務で未実装。UI は投稿側が実施済みであるかのように表示してはならない (mock/未接続と明示する)
- S8 (personal-domain-content-api-contract、shuttlepub domain、ShuttlePub/ShuttlePub、E8 に依存する契約のみの unit) が投稿・検索・通知の抑制契約、引用・純粋 boost 全体非表示、直接閲覧時の単一投稿 reveal、hidden 応答に本文等を漏らさないこと、reveal で block/CW/閲覧権を解除しないことを契約化する。投稿表示面の mock は S8 の生成 schema に準拠させる。host の queue では S8 は本 packet 作成時点で未登録で、別レーンで登録される (queue 登録後に dependencies へ追加する)。S8 が確定するまで、この投稿表示面 mock の実装は進めない
- mock 合意前の区分: 【先行可 (画面構成に依存しない)】domain-controls の BFF REST→GraphQL 変換、型生成、stateful mock (revision 競合・完全一致・Profile 分離・解除後非復元を再現)、S8 準拠の投稿 hidden/reveal fixture のデータ層と検証、Emumet 実接続の BFF 部分 (mock/real 切替)。【モック合意後】domain mute/block 設定画面、解除時非復元の説明の配置、投稿表示面 (引用・boost 全体非表示・単一投稿 reveal) の画面構成
- 【モック合意ゲート】画面構成 (レイアウト・画面遷移・デザイン) を決める UI 実装は、ユーザーとのモック合意が成立するまで実装 PR を出さない。モック合意は host の intent (ShuttlePub/host の intents/shuttlepub/ 配下) に記録される。画面実装を始める前にその合意記録を参照し (場所はこの issue 上のコメントで示される)、合意内容に従う。合意前に画面構成を独自に決めて実装しない。D08 のモック案は lead thread thread-xxs52dcx の artifact (artifact-05443f92d47738ca697b17e04b6febf8 等) にあるが、ユーザー合意は未成立 (合意記録ができるまで仕様として扱わない)。画面構成に依存しない部分は合意を待たずに先行してよい
- UI の意味 (D08 決定): mute は表示を抑制するが関係を切らない。block は表示抑制に加え対象 domain との既存 Follow/Follower を両方向に解除し、解除しても関係は復元されず復元用一覧も保持されない (再フォローは利用者の操作)。AP Block は送らない。完全一致のみ (example.com の設定は sub.example.com に適用されない)。設定は投稿用 Profile ごとで、同じ Account 内の別 Profile や他 Account に波及せず、全体 HostModeration にもならない
- 外部 ID は nanoid。Profile 選択は FA の Profile context を使う。access token は BFF が保持しブラウザに渡さない (FA の方式)
- schema 取込は F0 の方式 (producer commit SHA + checksum で固定した生成 OpenAPI → TS 型 → アプリ所有 GraphQL SDL → PureScript 型、fixture は OpenAPI に照合)。bff/schema.graphql・生成型は他 unit (FN・F15・F3 等) と直列に統合する
- 実 Emumet 接続の E2E は FA の実 Kratos/Hydra/Emumet 構成を流用する。mock と real の切替は明確にし、501 を成功扱いしない

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`
Path: apps/shuttlepub-web (BFF・GraphQL・画面・e2e), packages/ui (必要な場合のみ)
Part: shuttlepub-web の domain mute/block 設定 UI、解除時に関係が復元されない旨の説明、FA 経由の実 Emumet 接続 (domain-controls と Follow 解除の確認)、投稿表示面 (引用・boost 全体非表示、単一投稿 reveal) の S8 準拠 mock

## In Scope

- 【先行可】domain-controls の BFF REST→GraphQL 変換、型生成、E8/D8P 契約準拠の stateful mock (revision 競合・完全一致・Profile 分離・解除後非復元)、mock/real 切替
- 【先行可】S8 準拠の投稿 hidden/reveal fixture のデータ層と検証 (S8 確定後)
- 【モック合意後】domain mute/block 設定画面、解除時非復元の説明、投稿表示面 (引用・boost 全体非表示・単一投稿 reveal) の画面構成と実装
- 【D8R マージ後】FA 経由の実 Emumet 接続 E2E (実ログイン→実方針保存・取得→Follow 解除)
- Follow 制御は実適用、投稿部分は mock/未接続の明示

## Out Of Scope

- 未実装の ShuttlePub による投稿抑制・反応拒否を実施済みであるかのように表示すること、およびその実処理 (後続 unit)
- S8 契約そのもの (ShuttlePub/ShuttlePub)、Emumet 側の実装 (D8G/D8R/P4)
- モック合意前の画面構成の独自決定、ログイン画面 (FA 範囲)、管理者向けのサーバー単位 block/mute 画面
- Account 全体・サーバー全体への自動適用

## Standalone Child Issue Contract

shuttlepub-web に、利用者が自分の Profile の domain mute/block を設定・確認・解除する UI を実装する。解除してもブロックで解除した関係は復元されないことを説明し、FA 経由の実 Emumet に接続して実方針保存・取得・Follow 解除までを確認する。投稿表示面 (引用・boost 全体非表示、単一投稿 reveal) は S8 準拠の mock とし、投稿側の抑制・反応拒否は未実装なので mock/未接続と明示する。画面構成を決める実装はモック合意後。 本 PR は、shuttlepub-web の domain mute/block 設定 UI を実装し、FA 経由で実 Emumet に接続して Follow 解除まで確認する。投稿表示面は S8 準拠 mock とし、投稿側抑制の未接続を明示する。画面構成はユーザー合意のモックに従う。受け入れ条件の 10 項目を満たし、投稿抑制・反応拒否を実施済みと表示しない。

## Acceptance Criteria

1. 【実接続・D8R マージ後】FA 経由の実ログイン (Kratos/Hydra) から、選択した Profile で domain mute/block を実保存・再取得でき、block 設定で対象 domain との Follow/Follower 関係が実際に解除されることまで、実 Emumet に対する E2E で確認する
2. 設定は Profile ごとに分離され、Profile 切替で別 Profile の設定を混ぜない。同一 Account の別 Profile・他 Account の Profile に波及しない
3. revision 競合 (409)・不在 (404)・不正 domain (422)・未認証/権限不足 (401/403) を、黙って成功扱いにせず利用者に分かる形で扱う (再取得・再試行の導線を含む)。二重送信で状態が壊れない
4. domain は完全一致で扱い、sub.example.com に example.com の設定が適用されると誤認させない表示にする。サーバーが返す正規化形の domain を表示する
5. block 解除後に関係が復元されないこと (再フォローは利用者操作) の説明が UI にあり、解除後に Follow/Follower が実際に戻らないことを (実接続後は) 確認する
6. Follow 制御 (新規 Follow 拒否・既存関係解除) は実適用として扱い、投稿表示の抑制・反応拒否は mock/未接続と UI 上で明示する。投稿側が実施済みであるかのような表示をしない
7. 投稿表示面の mock が S8 準拠で、引用 (コメント付き引用の全体)・純粋 boost の全体非表示、単一投稿の明示 reveal、reveal しても CW・閲覧権が維持されること、hidden 応答に本文等が含まれないことを fixture で検証する
8. mock と実接続の切替が明確で、501 や未接続を成功として表示しない。dev API や契約外 API を呼ばない
9. 画面構成 (レイアウト・画面遷移・デザイン) を決める UI 部分は、host intent に記録されたユーザーとのモック合意に従って実装され、その合意記録を参照して作られている (合意前の独自画面構成を含まない)
10. キーボード操作でも設定・解除の導線が使え、SSR/hydration・mobile/desktop の visual baseline が通る。既存 CI が通る

## Verification

FA 経由の実 Emumet E2E (実ログイン→実方針保存・取得→Follow 解除、D8R マージ後)、BFF REST→GraphQL 変換と revision 競合・完全一致・Profile 分離・解除後非復元の stateful mock テスト、S8 準拠 fixture (引用/boost 全体非表示・単一投稿 reveal・CW/閲覧権維持・hidden 応答の漏洩検査)、生成型の再現性、SSR/hydration・mobile/desktop の visual。モック合意前は合意不要部分の検証のみで、画面の受け入れは合意後。

## Related Links

- host: intents/shuttlepub/product/social-experience.md (I08、primary)、intents/shuttlepub/packets/candidates.md (D08)、intents/emumet/features/personal-domain-controls/ (DC)、intents/emumet/features/profile-federation/
- F0: shuttlepub-frontends#27、FA: shuttlepub-frontends#28、E8: Emumet#66 / PR #70、D8P: Emumet#73 / PR #76。D8R・S8 の issue 番号は host の queue-state を参照

## Dependencies

shuttlepub-web-foundation、shuttlepub-web-emumet-auth、profile-domain-policy-api-contract、profile-domain-block-detach

## Merge Order

F0・FA はマージ済み (基盤部分)。【先行可】部分は E8 確定済みのためモック合意を待たず進め、S8 依存部分は S8 確定後。画面実装はモック合意後。実 Emumet 接続の最終受け入れは D8R (と P4) のマージ後。bff/schema.graphql・生成型は FN・F15・F3 等と直列に統合する。

## Knowledge Maintenance

- Intent placement: `intents/shuttlepub/product/social-experience.md (primary)。supporting: intents/shuttlepub/packets/candidates.md (D08 節)、intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d08-q01〜q15)、intents/shuttlepub/interviews/discord-feature-prioritization-2026-11-09.json (candidate-priority-q01〜q03)、intents/emumet/features/personal-domain-controls/overview.md ほか`
- ADR candidate: なし (製品意図は grill 記録で決定済み。UI 固有の新しい hard-to-reverse 決定なし)
- Diagram candidate: なし
- Docs update: UI の到達範囲 (Follow 制御は実適用、投稿部分は mock/未接続) と検証境界を I08 と DC に記録する
- Closeout writeback expected: yes — UI の判断点 (mute/block の説明、解除後非復元の表示、mock と実接続の差)、実 Emumet E2E の落とし穴、投稿部分が mock であることの表示方法、残る D08 実装 (ShuttlePub 側投稿制御) (host の `intents/shuttlepub/product/social-experience.md`、`intents/shuttlepub/packets/candidates.md` へ。host 更新は親が行う)

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → ShuttlePub/shuttlepub-frontends リポジトリ (apps/shuttlepub-web)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
