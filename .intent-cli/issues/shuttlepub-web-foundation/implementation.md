# shuttlepub-web-foundation Implementation Packet

## Goal

ShuttlePub/shuttlepub-frontends に SNS メイン UI アプリ `apps/shuttlepub-web`(PureScript + Flame、SSR/hydration、Bun BFF)の土台を新設する。共有 UI/style の利用、ルート、Profile context、fixture、既存 CI / visual 経路への登録に加え、ShuttlePub が生成する OpenAPI schema を固定して取り込み、型生成・adapter・SDL・fixture 照合まで再現可能に接続する基盤を作る。後続の SNS UI(quick-reaction-web-ui 等)と認証(shuttlepub-web-emumet-auth)はこの土台に載る。

## Why

ShuttlePub backend の着手には時間がかかる可能性があるため、UI を先行させる方針になった。UI は backend 実装を待たず、ShuttlePub の生成 OpenAPI schema を契約として使う。そのため、schema を固定して取り込み、他 repo やネットワークに依存せずビルド・mock 起動できる UI アプリの土台が、D03(quick reaction)など各 UI の前提として先に必要になる。

## Scope

- `apps/shuttlepub-web` の新設: PureScript + Flame の SSR + hydration、Bun BFF、共有 UI/style(packages/ui・styles・design-tokens)の利用、ルート、Profile context、fixture
- OpenAPI 取込基盤: (1) producer commit SHA + checksum で固定した生成 OpenAPI の取得・repo 内保持 (2) OpenAPI から TS REST 型生成 (3) 型付き adapter でアプリ所有 GraphQL SDL へ接続 (4) 既存方式での SDL から PureScript 型生成 (5) fixture を OpenAPI に照合
- mock / real の明示的な切替(real の 501・失敗を成功や mock へ黙って切り替えない)
- root lockfile(bun.lock)・workspace 登録・既存 CI(check.yml 等)への新アプリ登録・visual driver/case の登録と初回 visual baseline(mobile / desktop)・hydration の検証
- 【モック合意後の後続 PR】画面レイアウトの実装と、画面構成を固定する visual baseline(ゲート対象。上記ゲートに従う)。基盤 PR の visual baseline は画面構成を決めない最小の骨格表示に限る

## Out of scope

- 実認証(OIDC ログイン・session・Emumet 連携。shuttlepub-web-emumet-auth で扱う)
- 本格的なタイムライン・投稿 UI
- 独自のデザイン基盤の新設(既存の共有 packages を使う)
- ShuttlePub backend の実装・OpenAPI schema の定義(S0 / S3 側)
- モック合意前の画面構成の独自決定

## Design notes

- 取込 schema は repo 内に固定(producer commit SHA と checksum を記録)。更新は明示的なコマンドで行い、ビルドは常にオフラインで通る
- mock/real 切替はビルド/起動時の設定で明示し、実行中の暗黙フォールバックを持たない
- 基盤 PR と画面レイアウト PR(モック合意後)を分ける。基盤 PR では骨格(空のシェル・ルート定義)を超える画面デザインを決め打ちしない。画面実装前に host intent のモック合意記録を参照する

## Verification

- ネットワークなし・他 repo checkout なしでの bun install --frozen-lockfile、PureScript ビルド、mock 起動
- codegen の再現性(再生成して差分なし)と schema の SHA / checksum 不一致検知のテスト
- fixture の OpenAPI 照合テスト(schema に反する fixture が失敗すること)
- mock/real 切替のテスト(real の 501・失敗を成功や mock へ切り替えないこと)
- SSR 出力の hydration テストと mobile / desktop の visual baseline(既存 visual CI 経路)
- 既存アプリの CI(emumet-web / booskiff-web / ui-catalog)と新アプリ登録後の CI がグリーン、purs-tidy check、git diff --check

## Knowledge Maintenance (G461)

- Intent placement: social-experience.md と candidates.md の共通の分割方針・D03 節へ F0 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none(S0 の ADR に従う)
- Diagram candidate: none
- Docs update: schema 取込経路・mock/real 切替・検証境界を technology/overview.md / social-experience.md に記録
- Closeout writeback expected: yes
