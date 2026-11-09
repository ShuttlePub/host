## Goal

ShuttlePub/shuttlepub-frontends に SNS メイン UI アプリ `apps/shuttlepub-web`(PureScript + Flame、SSR/hydration、Bun BFF)の土台を新設する。共有 UI/style の利用、ルート、Profile context、fixture、既存 CI / visual 経路への登録に加え、ShuttlePub が生成する OpenAPI schema を固定して取り込み、型生成・adapter・SDL・fixture 照合まで再現可能に接続する基盤を作る。後続の SNS UI(quick-reaction-web-ui 等)と認証(shuttlepub-web-emumet-auth)はこの土台に載る。

## Why This Slice Exists Now

ShuttlePub backend の着手には時間がかかる可能性があるため、UI を先行させる方針になった。UI は backend 実装を待たず、ShuttlePub の生成 OpenAPI schema を契約として使う。そのため、schema を固定して取り込み、他 repo やネットワークに依存せずビルド・mock 起動できる UI アプリの土台が、D03(quick reaction)など各 UI の前提として先に必要になる。

## Current Observed State

- shuttlepub-frontends(main 4be1b63 時点)は Bun workspaces で apps/emumet-web・apps/booskiff-web・apps/ui-catalog と packages/{design-tokens,styles,ui,auth-core,auth-bun} を持つ
- CI は .github/workflows の check.yml / e2e.yml / frontend-visual.yml / frontend-visual-publish.yml。visual は apps/ui-catalog/visual に撮影対象(driver/case)を登録する方式
- SNS メイン UI アプリ(apps/shuttlepub-web)は存在せず、OpenAPI schema の取込・型生成経路もない
- 既存アプリの SDL から PureScript 型を生成する方式が既にある(それを踏襲する)

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は ShuttlePub/ShuttlePub の server 層(Axum)に utoipa 等で実装し、そこから OpenAPI schema を生成する。ハンドラーの本実装はこの段階では行わない。frontends の SNS UI はこの生成 schema を使う。旧 docs/openapi.json は廃止予定で互換を考慮しない
- S0(shuttlepub-openapi-foundation)が `openapi/shuttlepub.json` を生成・コミットする。取込は producer の commit SHA + checksum で固定する
- 本 slice の取込基盤が提供する型・adapter・fixture 照合を後続ユニットが使う。root lockfile・workspace・CI・visual 登録は本 slice が所有する
- 実認証(Hydra OIDC ログイン等)は別ユニット(shuttlepub-web-emumet-auth)。本 slice は実認証を含まない
- 生成物は手編集しない。再生成コマンドと差分検出を CI に含める
- 【モック合意ゲート】画面構成(レイアウト・画面遷移・デザイン)を決める UI 実装は、ユーザーとのモック合意が成立するまで実装 PR を出さない。モック合意は host の intent(ShuttlePub/host の intents/shuttlepub/ 配下)に記録される。画面実装を始める前にその合意記録を参照し(場所はこの issue 上のコメントで示される)、合意内容に従う。合意前に画面構成を独自に決めて実装しない。画面構成に依存しない部分は合意を待たずに先行してよい
- 範囲の分け方: 【基盤(先行可)】画面構成に依存しないビルド・CI・workspace/lockfile・schema 取込/codegen・fixture 照合・mock/real 切替・BFF・SSR/hydration の仕組み(空のシェルと最小のルート定義まで)。【画面レイアウト(モック合意後)】ルート別の画面レイアウト・画面遷移・共有 UI の見た目と、それを固定する画面構成入りの visual baseline。画面レイアウト部分は同 unit の後続 PR で、モック合意後に実装する。基盤の PR に画面レイアウトを含めない

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/shuttlepub-web`, `package.json`, `bun.lock`, `.github/workflows`, `apps/ui-catalog/visual`

Target part: "SNS メイン UI アプリ(PureScript + Flame SSR/hydration + Bun BFF)の土台、OpenAPI schema 取込・codegen 基盤、mock/real 切替、CI / visual 登録"

## In Scope

- `apps/shuttlepub-web` の新設: PureScript + Flame の SSR + hydration、Bun BFF、共有 UI/style(packages/ui・styles・design-tokens)の利用、ルート、Profile context、fixture
- OpenAPI 取込基盤: (1) producer commit SHA + checksum で固定した生成 OpenAPI の取得・repo 内保持 (2) OpenAPI から TS REST 型生成 (3) 型付き adapter でアプリ所有 GraphQL SDL へ接続 (4) 既存方式での SDL から PureScript 型生成 (5) fixture を OpenAPI に照合
- mock / real の明示的な切替(real の 501・失敗を成功や mock へ黙って切り替えない)
- root lockfile(bun.lock)・workspace 登録・既存 CI(check.yml 等)への新アプリ登録・visual driver/case の登録と初回 visual baseline(mobile / desktop)・hydration の検証
- 【モック合意後の後続 PR】画面レイアウトの実装と、画面構成を固定する visual baseline(ゲート対象。上記ゲートに従う)。基盤 PR の visual baseline は画面構成を決めない最小の骨格表示に限る

## Out Of Scope

- 実認証(OIDC ログイン・session・Emumet 連携。shuttlepub-web-emumet-auth で扱う)
- 本格的なタイムライン・投稿 UI
- 独自のデザイン基盤の新設(既存の共有 packages を使う)
- ShuttlePub backend の実装・OpenAPI schema の定義(S0 / S3 側)
- モック合意前の画面構成の独自決定

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: shuttlepub-frontends に `apps/shuttlepub-web` を新設し、PureScript + Flame の SSR/hydration と Bun BFF の土台、固定した OpenAPI schema の取込・型生成・adapter・SDL・fixture 照合基盤、mock/real の明示切替、既存 CI / visual への登録と初回 visual baseline を整えること。他 repo やネットワークなしでビルド・mock 起動でき、codegen は再現可能で生成物は手編集しない。画面構成を決める UI 部分は、ユーザーとのモック合意後にのみ実装する。

## Acceptance Criteria

- 他 repo の checkout やネットワークなしで、ビルドと mock 起動ができる(取り込んだ schema は repo 内に固定済み)
- codegen が再現可能で、生成物は手編集しない(再生成して差分がなければ CI がグリーン、差分があれば失敗)。schema は producer commit SHA と checksum で固定され、不一致を検知する
- mock と real の切替が明示的で、real が 501(未実装)や失敗を返したとき成功や mock へ黙って切り替えない
- fixture が取り込んだ OpenAPI に照合され、schema に反する fixture は失敗する
- SSR された画面が hydration され、mobile / desktop の両幅で表示できる
- 初回の visual baseline が既存 visual CI 経路に登録されている
- 既存アプリ(emumet-web / booskiff-web / ui-catalog)の CI を壊さず、新アプリが既存 CI へ登録されグリーン
- 画面構成(レイアウト・画面遷移・デザイン)を決める UI 部分は、host intent に記録されたユーザーとのモック合意に従って実装され、その合意記録を参照して作られている(合意前の独自画面構成を含まない)

## Verification

- ネットワークなし・他 repo checkout なしでの bun install --frozen-lockfile、PureScript ビルド、mock 起動
- codegen の再現性(再生成して差分なし)と schema の SHA / checksum 不一致検知のテスト
- fixture の OpenAPI 照合テスト(schema に反する fixture が失敗すること)
- mock/real 切替のテスト(real の 501・失敗を成功や mock へ切り替えないこと)
- SSR 出力の hydration テストと mobile / desktop の visual baseline(既存 visual CI 経路)
- 既存アプリの CI(emumet-web / booskiff-web / ui-catalog)と新アプリ登録後の CI がグリーン、purs-tidy check、git diff --check

## Related Links

- 先行ユニット: shuttlepub-openapi-foundation({{S0}}、ShuttlePub/ShuttlePub)— 生成 schema の producer
- 後続ユニット: shuttlepub-web-emumet-auth(認証)、quick-reaction-web-ui(UI)
- 既存の参考実装: apps/emumet-web、apps/booskiff-web、apps/ui-catalog(visual)
- 意図: intents/shuttlepub/product/social-experience.md、intents/shuttlepub/packets/candidates.md (共通の分割方針、D03)

## Knowledge Maintenance

- Intent placement: social-experience.md と candidates.md の共通の分割方針・D03 節へ F0 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none(S0 の ADR に従う)
- Diagram candidate: none
- Docs update: schema 取込経路・mock/real 切替・検証境界を technology/overview.md / social-experience.md に記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/shuttlepub-frontends (`apps/shuttlepub-web`, `package.json`, `bun.lock`, `.github/workflows`, `apps/ui-catalog/visual`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
