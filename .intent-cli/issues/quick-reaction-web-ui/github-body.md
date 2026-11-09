## Goal

apps/shuttlepub-web に、クイックリアクション UI を実装する。ピッカー最上段に常用絵文字(最大 5)を表示し、反応済みの投稿ではピッカーの代わりに選択中の絵文字を表示して押すと解除してピッカーを再表示する(1 人 1 投稿 1 反応)。常用絵文字を設定する Profile 設定 UI も含む。受け入れは S3 の API 契約に準拠するステートフル mock で行い、実保存 backend や端末間同期が完成したとは表示しない。

## Why This Slice Exists Now

D03(クイックリアクション)の製品意図は grill で確定している(常用絵文字は同じ Profile で端末間共通、ピッカー最上段、反応済みは選択絵文字を表示して解除)。ShuttlePub backend の実装を待たず、UI 先行方針に従い、S3 の契約に準拠する mock を使って UI を完成させる。

## Current Observed State

- apps/emumet-web の画面列挙・設定画面には投稿リアクション UI・常用絵文字設定がない(2026-10-19 の限定確認、4be1b63)
- apps/shuttlepub-web は F0 で新設される前提、S3 の契約・生成 schema は S3 で追加される前提(本ユニットは両方に依存)
- ShuttlePub の Profile 設定 API・reaction API(/api/v1)は契約のみで、実保存は未実装(501)

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は ShuttlePub/ShuttlePub の server 層(Axum)に utoipa 等で実装し、そこから OpenAPI schema を生成する。ハンドラーの本実装はこの段階では行わない。frontends の SNS UI はこの生成 schema を使う。旧 docs/openapi.json は廃止予定で互換を考慮しない
- 製品意図(確定済み): 常用絵文字は同じ投稿用 Profile で端末間共通・最大 5 個。未反応投稿ではリアクションボタンで開くピッカー最上段に表示(選択に 2 操作)。反応済み投稿は選択中の絵文字をボタン/ピッカーの代わりに表示し、押すと解除してピッカーを再表示。変更は解除後にピッカーで選ぶ。常用未設定ならピッカー最上段の常用欄なし(サーバー管理の初期値絵文字は導入しない)。利用不可はグレーアウト+設定画面で「利用不可」表示、代替送信・設定の自動削除なし
- S3 の契約: 設定 GET/PUT(revision)、reaction GET/PUT/DELETE、DELETE は利用可否に依存しない。確定した生成 schema が正本
- mock は S3 準拠のステートフル mock。複数 session から同一 Profile を参照できること。実 backend は 501 のため real への暗黙切替はしない(F0 の mock/real 切替に従う)
- 既存 dev API `POST /api/notes/{id}/reactions` は legacy で、UI は呼ばない
- 【モック合意ゲート】画面構成(レイアウト・画面遷移・デザイン)を決める UI 実装は、ユーザーとのモック合意が成立するまで実装 PR を出さない。モック合意は host の intent(ShuttlePub/host の intents/shuttlepub/ 配下)に記録される。画面実装を始める前にその合意記録を参照し(場所はこの issue 上のコメントで示される)、合意内容に従う。合意前に画面構成を独自に決めて実装しない。画面構成に依存しない部分は合意を待たずに先行してよい
- ゲート対象は UI 全体(ピッカー・常用絵文字設定画面を含む)。ユーザーとのモック合意が成立するまで UI の実装 PR を出さない。画面実装前に host intent の合意記録を参照する。F3 のうち UI 以外(S3 準拠ステートフル mock・状態遷移ロジック・fixture 照合)は、画面を伴わない範囲で先行してよいが、画面構成を決める内容を含めない

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/shuttlepub-web`, `packages/ui`

Target part: "リアクションピッカー最上段の常用絵文字、反応済み表示と解除、常用絵文字の Profile 設定 UI、S3 準拠のステートフル mock"

## In Scope

- リアクションピッカー最上段の常用絵文字(最大 5、利用不可はグレーアウト)
- 反応済み表示(選択中の絵文字)と押下での解除・ピッカー再表示、1 人 1 投稿 1 反応
- 常用絵文字の Profile 設定 UI(最大 5・一意・順序、利用不可表示、revision 競合・失敗・再送の処理)
- 二重送信防止・送信失敗・Profile 切替の処理
- S3 準拠のステートフル mock(複数 session から同一 Profile を参照)と、mock 受け入れ用の fixture(S3 の fixture を再利用/照合)
- UI テスト・visual baseline(mobile / desktop)とキーボード操作
- 【モック合意後】ピッカー・反応済み表示・常用絵文字設定画面を含む UI の実装(ゲート対象。実装前に host intent の合意記録を参照)

## Out Of Scope

- ShuttlePub 実保存・端末間同期の完成の主張(実保存 backend が未実装であることを完成と表示しない)
- dev reaction API(POST /api/notes/{id}/reactions)の呼び出し
- FA(実認証)への依存。mock 受け入れに FA は不要
- 異なる Profile 間・Account 全体での設定共有、D05 / D13 の設定
- モック合意前の画面構成の独自決定

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: apps/shuttlepub-web に、ピッカー最上段の常用絵文字(最大 5)、反応済みの選択絵文字表示と解除、Profile 設定 UI、二重送信・失敗・Profile 切替の処理を、S3 準拠のステートフル mock 上で実装し、UI テストと visual で検証すること。dev reaction API を呼ばず、実保存未実装を完成と表示しない。画面構成を決める UI 部分は、ユーザーとのモック合意後にのみ実装する。

## Acceptance Criteria

- 未反応投稿: リアクションボタンで開くピッカーの最上段に常用絵文字(最大 5)を表示し、選択まで 2 操作になる
- 反応済み投稿: ピッカーの代わりに選択中の絵文字を表示し、押すと解除してピッカーを再表示する。変更は解除後にピッカーで選ぶ(ピッカーから直接置換しない)
- 1 人 1 投稿 1 反応が UI 状態として保たれる
- 常用絵文字が未設定なら最上段の常用欄を表示せず通常ピッカーのみ。サーバー管理の初期値絵文字を導入しない
- 利用不可の常用絵文字はピッカー最上段でグレーアウトして選択不可、設定画面で「利用不可」と表示して入れ替えを促す。別絵文字での代替送信・設定の自動削除をしない
- 利用不可になった選択済み反応でも解除できる
- Profile 設定 UI で常用絵文字を最大 5 件・一意・順序付きで設定でき、revision 競合・失敗・再送が処理される
- 二重送信・送信失敗・Profile 切替で状態が壊れない(切替後に別 Profile の設定・反応を混ぜない)
- 複数 session から同一 Profile の設定を参照でき、同じ常用絵文字が使える(S3 準拠 mock で検証)
- 実保存 backend が未実装であることを完成として表示しない。dev reaction API を呼ばない
- キーボード操作でも同じ導線が使える
- 画面構成(レイアウト・画面遷移・デザイン)を決める UI 部分は、host intent に記録されたユーザーとのモック合意に従って実装され、その合意記録を参照して作られている(合意前の独自画面構成を含まない)

## Verification

- S3 準拠 stateful mock に対する UI テスト(0 / 5 件、未反応→選択、反応済み→解除→ピッカー再表示、利用不可、利用不可の選択済み反応の解除、二重送信、失敗、revision 競合、Profile 切替)
- 複数 session から同一 Profile の設定を参照するテスト
- fixture / mock 応答が S3 の生成 schema に照合されること
- visual baseline(mobile / desktop)とキーボード操作テスト
- dev reaction API が呼ばれないことのテスト、既存 CI と git diff --check がグリーン

## Related Links

- 先行ユニット: shuttlepub-web-foundation({{F0}}、ShuttlePub/shuttlepub-frontends)、quick-reaction-api-contract({{S3}}、ShuttlePub/ShuttlePub)
- 意図: intents/shuttlepub/product/social-experience.md (I03)、intents/shuttlepub/packets/candidates.md (D03)
- 決定記録: intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d03-q01〜q07、q06 は訂正版)

## Knowledge Maintenance

- Intent placement: social-experience.md I03 節と candidates.md D03 節へ F3 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: UI の到達範囲(mock 受け入れ・実保存未完成)と検証境界を I03 / D03 に記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/shuttlepub-frontends (`apps/shuttlepub-web`, `packages/ui`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
