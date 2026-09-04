## Goal

shuttlepub-frontends モノレポに新しい workspace アプリ `apps/ui-catalog` を新設し、
packages/ui の全共有コンポーネント (Layout/Link/NotFound/Theme shell primitives) と
design-tokens/styles のショーケース (色・radius・shadow) を、テーマ切替
(Catppuccin Mocha / Tokyo Night × rounded / sharp) 付きで一覧できる Flame 製カタログを実装する。
併せて agent がブラウザなしでカタログ内容を列挙できる JSON manifest を出力する。

## Why This Slice Exists Now

目的は「共有デザイン/コンポーネントを確認しやすくすること」であり、Storybook は手段候補に
すぎないと確定した (storybook-introduction インタビュー)。PureScript/Flame では Storybook の
強み (args/play/自動 docs/MCP manifest) が使えず HTML ビューア化するため不採用とし、
Flame 製カスタムカタログを採用する。本ユニットはカタログ基盤のみを納め、visual diff /
PR 連携は後続ユニット (ui-catalog-visual-diff-ci) に分離する。

## Current Observed State

- shuttlepub-frontends モノレポは存在し、`apps/emumet-web` + `apps/booskiff-web` + `packages/{design-tokens,styles,ui,auth-core,auth-bun}` 構成 (2026-08-30 D1-D8)
- packages/ui に共有コンポーネント (Theme class 定数、shell primitives: document/navBar/contentArea/navLink/notFound) が抽出済み
- 共有デザイン/コンポーネントを一覧確認する手段はなく、カタログアプリも Storybook も存在しない

## Accepted Baseline You May Assume

- アーキテクチャは apps/emumet-web / apps/booskiff-web と同一の PureScript + Flame SSR + hydration + Bun サーバー構成を踏襲する (実アプリと同一経路で SSR HTML と hydration 後の両方を検証するため)
- spago workspace はアプリ側 spago.yaml に集約し、packages/ui は extraPackages の `path:` 参照で接続 (D6)
- Tailwind v4 は `@shuttlepub/styles` 経由。`@source` を packages 配下まで明示拡張しないとクラス収集が崩れる (monorepo-extraction 運用知見)
- テーマ切替は packages/design-tokens/theme.js と同じ data-color / data-shape 属性方式
- 初回スコープは共有パッケージのみ。アプリ固有 View の fixture 化は後追い検討
- BFF/バックエンド非依存: fixture/static データのみ

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/ui-catalog`

Target part: "PureScript + Flame SSR + hydration 製の UI カタログアプリ (apps/ui-catalog) と agent 向け JSON manifest"

## In Scope

- `apps/ui-catalog` workspace アプリの新設 (Bun workspaces 登録、Flame SSR + hydration + Bun サーバー、spago/dev.sh/Tailwind 配線)
- packages/ui 全コンポーネント + design-tokens/styles (色・radius・shadow) のショーケース
- テーマ切替 UI (Catppuccin Mocha / Tokyo Night × rounded / sharp、data-color / data-shape)
- JSON manifest 出力 (コンポーネント名・ストーリー/状態・直接 URL 一覧。アプリ配信例: `/manifest.json`、および/または生成ファイル)

## Out Of Scope

- visual diff / PR 連携基盤 (後続ユニット ui-catalog-visual-diff-ci)
- 各アプリ固有の View (Login/Accounts/Drive 等) の fixture 化
- Storybook / Chromatic の導入
- BFF・Emumet API との接続

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: shuttlepub-frontends リポジトリに `apps/ui-catalog` を
新設し、既存アプリと同一の PureScript + Flame SSR + hydration + Bun サーバー構成で、
packages/ui の全共有コンポーネントと design-tokens (色/radius/shadow) のショーケースを
テーマ切替付きで一覧できること。SSR HTML と hydration 後の両方が表示されること。
カタログが JSON manifest (コンポーネント名・ストーリー/状態・直接 URL 一覧) を出力し、
ブラウザなしで内容を列挙できること。BFF/バックエンドには依存せず fixture/static データのみで
構成すること。

## Acceptance Criteria

- apps/ui-catalog 起動で packages/ui 全コンポーネント (Layout/Link/NotFound/Theme shell primitives) と design-tokens (色/radius/shadow) のショーケースを一覧でき、テーマ (Catppuccin Mocha / Tokyo Night × rounded / sharp) を切替確認できる
- SSR HTML と hydration 後の両方が表示される (実アプリと同一経路でレンダリング)
- カタログが JSON manifest (コンポーネント名・ストーリー/状態・直接 URL 一覧) を出力し、agent がブラウザなしでカタログ内容を列挙できる

## Verification

- `apps/ui-catalog` が起動し、全ショーケースページが SSR HTML と hydration 後の両方で表示される
- テーマ切替 (data-color / data-shape) が全ページで反映される
- JSON manifest をブラウザなし (curl 等) で取得でき、コンポーネント/ストーリー/URL が列挙できる
- PureScript コンパイル・production build が通る
- `bun test` がグリーン
- `git diff --check`

## Related Links

- インタビュー記録: `intents/ratcap/interviews/storybook-introduction.json`
- ドラフト intent: `intents/ratcap/drafts/storybook-introduction.md`
- モノレポ決定記録 (D1-D8): `intents/ratcap/decisions/2026-08-30-monorepo-extraction.md`
- マップ: `intents/ratcap/intent-tree/00-map.md`
- 後続ユニット: ui-catalog-visual-diff-ci (visual diff / PR 連携基盤)

## Knowledge Maintenance

- Intent placement: `intents/ratcap/intent-tree/00-map.md` に ui-catalog 行を追加 (新規 intent 不要)。併せて map 冒頭の Target repo 表記を ShuttlePub/shuttlepub-frontends に修正
- ADR candidate: `intents/ratcap/decisions/2026-09-05-ui-catalog-over-storybook.md` — Storybook 不採用・カスタムカタログ採用の決定を closeout 時に作成
- Diagram candidate: none
- Docs update: none (内部開発者向け基盤)
- Closeout writeback expected: yes (spago workspace 配置・Tailwind @source 配線の知見を `intents/ratcap/technology/overview.md` へ)

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が
shuttlepub-frontends リポジトリ (apps/ui-catalog) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
