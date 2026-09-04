# ui-catalog-foundation Implementation Packet

## Goal

ShuttlePub/shuttlepub-frontends モノレポに新しい workspace アプリ `apps/ui-catalog` を新設し、
packages/ui の全共有コンポーネント (Layout/Link/NotFound/Theme shell primitives) と
design-tokens/styles のショーケース (色・radius・shadow) を、テーマ切替
(Catppuccin Mocha / Tokyo Night × rounded / sharp) 付きで一覧できる Flame 製カタログを実装する。
併せて agent がブラウザなしでカタログ内容を列挙できる JSON manifest
(コンポーネント名・ストーリー/状態・直接 URL 一覧) を出力する。

## Why

storybook-introduction インタビューで、目的は「共有デザイン/コンポーネントを確認しやすくすること」
であり Storybook は手段候補にすぎないと確定した。PureScript/Flame では Storybook の強み
(args/play/自動 docs/MCP manifest) が使えず HTML ビューア化するため不採用とし、
Flame 製カスタムカタログを採用する。実アプリと同一構成 (SSR + hydration + Bun サーバー) で
レンダリングすることで、SSR HTML の見た目と hydration 後の挙動の両方を実アプリと同一経路で
検証できることを重視する。本ユニットはカタログ基盤のみを納め、visual diff / PR 連携は後続の
ui-catalog-visual-diff-ci に分離する。

## Scope

- `apps/ui-catalog` workspace アプリの新設 (Bun workspaces 登録、PureScript + Flame SSR + hydration + Bun サーバー。apps/emumet-web / apps/booskiff-web と同一構成、spago/dev.sh の先例を踏襲)
- spago 配線: アプリ側 spago.yaml に workspace を集約し、packages/ui は extraPackages の `path:` 参照で接続 (D6)
- Tailwind v4 配線: `@shuttlepub/styles` 経由で、`apps/ui-catalog/src/style.css` の `@source` を packages 配下まで明示拡張 (content detection hazard 対策)
- ショーケース: packages/ui 全コンポーネント (Layout/Link/NotFound/Theme shell primitives) + design-tokens/styles (色・radius・shadow)
- テーマ切替 UI: packages/design-tokens/theme.js と同じ data-color / data-shape 属性方式 (Catppuccin Mocha / Tokyo Night × rounded / sharp)
- JSON manifest 出力: コンポーネント名・ストーリー/状態・直接 URL の一覧を、アプリ配信 (例: `/manifest.json`) および/または生成ファイルとして提供
- fixture/static データのみで構成 (BFF/バックエンド非依存)

## Out of scope

- visual diff / PR 連携基盤 (後続ユニット ui-catalog-visual-diff-ci)
- 各アプリ固有の View (Login/Accounts/Drive 等) の fixture 化 (カタログの仕組みが安定してから後追いで検討)
- Storybook / Chromatic の導入
- BFF・Emumet API との接続

## Verification

- `apps/ui-catalog` が起動し、全ショーケースページが SSR HTML と hydration 後の両方で表示される
- テーマ切替 (data-color / data-shape) が全ページで反映される
- JSON manifest をブラウザなし (curl 等) で取得でき、コンポーネント/ストーリー/URL が列挙できる
- PureScript コンパイル・production build が通る
- `bun test` がグリーン (check.yml との整合)
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/ratcap/intent-tree/00-map.md` に ui-catalog 行 (foundation + visual-diff-ci) を追加する。併せて map 冒頭の Target repo 表記を ShuttlePub/Ratcap から ShuttlePub/shuttlepub-frontends に修正する (新規 intent ノードは不要)
- ADR candidate: `intents/ratcap/decisions/2026-09-05-ui-catalog-over-storybook.md` — Storybook 不採用・Flame 製カスタムカタログ採用の決定を closeout 時に記録する
- Diagram candidate: none
- Docs update: none (内部開発者向け基盤のためユーザー向け docs は対象外)
- Closeout learning: 2 つ目以降の PureScript アプリ追加に伴う spago workspace 配置 (D6 の再検討条件への回答) と Tailwind @source 配線・テーマ切替 UI の知見を `intents/ratcap/technology/overview.md` へ write back する (write_back_required: true)

- Guide reachability (G645): `guide workflow task implementation-loop` (implementation ロール) が
  shuttlepub-frontends リポジトリ (apps/ui-catalog) へルーティングする。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
