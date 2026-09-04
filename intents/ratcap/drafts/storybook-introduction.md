---
# Optional semantic facets (G529) — closed set, one line each:
#   vocabulary            — event/command vocabulary: what counts as a fact
#   invariant              — invariants and consistency boundaries
#   decider                — decider judgments: what a command decides
#   acceptance-property    — what must not break
# Uncomment and edit to annotate this node, e.g.:
# facets: [vocabulary]
---

# Draft intent — ratcap / session storybook-introduction

> Compiled from accepted interview answers. Operator must accept this draft before any source-of-truth mutation.

## Accepted baseline

### storybook-purpose — 「Storybookの導入」自体が目的か、「共有デザイン/コンポーネントを確認しやすくする」が目的でStorybookは手段候補か

目的は「共有デザイン/コンポーネントを確認しやすくすること」であり、Storybook は手段候補にすぎない。要件として (1) CI 経由で PR に結果（カタログ/ビジュアル差分等）を載せたい、(2) coding agent からも確認しやすい形が望ましい、がある。Storybook が何を解決するのか正確に理解した上で、採用可否・方式（Storybook vs Flame 製カタログ等）を再検討する。


### catalog-implementation-approach — カタログの実現方式: カスタムカタログ / Storybook HTML限定 / Storybook+Chromatic / PoC

方式はカスタムカタログとする。Flame 製カタログアプリ（apps/ui-catalog 等）を新設し、Playwright でスクリーンショットを取得、reg-suit 等で差分を CI/PR に連携する。agent 向けにはカタログ側で独自 JSON manifest（コンポーネント/ストーリー/URL/状態の列挙）を生成する。Storybook は採用しない（PureScript/Flame では args/play/自動docs/MCP manifest 等の強みが使えず、HTML ビューア化するため）。


### catalog-initial-scope — カタログの初回対象範囲: 共有パッケージのみ / アプリViewも含む / トークンのみ

初回スコープは共有パッケージのみ: packages/ui の共有コンポーネント（Layout/Link/NotFound/Theme）と design-tokens/styles のショーケース（色・radius・shadow・テーマ切替）を対象とする。各アプリ固有の View（Login/Accounts/Drive 等）の fixture 化は初回スコープ外とし、カタログの仕組みが安定してから後追いで検討する。


### catalog-app-architecture — ui-catalog のレンダリング構成: SSR+hydration同一構成 / 静的SSRのみ / クライアントのみ

ui-catalog は apps/ui-catalog として独立 workspace アプリとし、既存アプリ（emumet-web/booskiff-web）と同一の PureScript + Flame SSR + hydration + Bun サーバー構成を踏襲する。実アプリと同一経路で SSR HTML の見た目と hydration 後の挙動の両方を検証できることを重視。spago/dev.sh/Tailwind @source 設定の先例を踏襲する。


### visual-diff-pr-integration — visual diff / PR連携基盤: reg-cli+Actions / reg-suit+外部ストレージ / Playwrightのみ

visual diff / PR 連携基盤: 外部ストレージ方式を採用。Cloudflare R2（S3 互換）に差分画像・レポートを期限付き（ライフサイクルルールで自動削除）でアップロードし、PR コメント上に差分画像を直接埋め込んで表示する。レポート zip の DL 確認は不可。基盤は reg-suit（S3 互換プラグインで R2 接続）を第一候補とし、PR コメントへの画像直接埋め込みは reg-notify-github-plugin の能力を実装時に検証、不足する場合は自前のアップロード + コメント生成ステップで補完する。


### acceptance-criteria — 受け入れ条件: 提案3点セットで確定か

受け入れ条件は以下の3点で確定: (1) apps/ui-catalog 起動で packages/ui 全コンポーネントと design-tokens（色/radius/shadow）のショーケースを一覧でき、テーマ（Catppuccin Mocha / Tokyo Night × rounded / sharp）を切替確認できる。SSR HTML と hydration 後の両方が表示される。(2) 共有パッケージの見た目変更を含む PR で CI がスクリーンショット差分を検出し、R2 にアップロードされた差分画像が PR コメントに直接表示される。差分なし PR では緑 check。(3) カタログが JSON manifest（コンポーネント名・ストーリー/状態・直接 URL 一覧）を出力し、agent がブラウザなしでカタログ内容を列挙できる。


## Open questions

- none

## Candidate execution units

- TODO — operator decides whether to promote this draft into a published child issue.
