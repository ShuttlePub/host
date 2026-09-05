# 2026-09-05: Storybook 不採用・Flame 製カスタム UI カタログ採用

## 決定

共有デザイン/コンポーネントの確認基盤として Storybook は**不採用**とし、Flame 製カスタムカタログ
`apps/ui-catalog`（PureScript + Flame SSR + hydration + Bun サーバー）+ Playwright + visual diff
（reg-suit / Cloudflare R2）+ 独自 JSON manifest を採用する。

## 背景

「Storybook を導入したい」という要望から grill（storybook-introduction インタビュー、6問確定）で
再検討した結果、真の目的は「共有デザイン/コンポーネントを確認しやすくすること」と確定。要件は
(1) CI 経由で PR に結果を載せる、(2) coding agent からも確認しやすい形、の2点。

## 不採用の根拠

- Storybook の中核価値（分離コンポーネント開発、stories fixture、自動 docs、args/play、
  Vitest addon、MCP manifest）は JS フレームワーク（React/Angular/Vue 等）前提であり、
  PureScript/Flame では `@storybook/html-vite` の escape hatch で SSR HTML を表示する以上の
  統合が得られず「高価な HTML ビューア」化する
- 公式 Storybook MCP の component manifest 生成対象は React/Angular/Vue に限定され、
  PureScript では adapter 自作が必要
- CI/PR 連携の本線は Chromatic（有償: Free 5,000 snapshots/月、Starter $179/月〜）であり、
  セルフホストでは preview deploy + PR bot を自前構築する必要がある
- 見た目検証にはどの方式でも Playwright 等のブラウザが必須であり、Storybook 導入で
  このコストは消えない

## 採用方式の要点

- カタログアプリは既存アプリ（emumet-web / booskiff-web）と同一の SSR+hydration+Bun 構成で
  実アプリと同一経路を検証できる
- agent 向け JSON manifest（コンポーネント名・ストーリー/状態・直接 URL）をカタログ側で配信
- visual diff は Cloudflare R2（S3 互換・期限付きライフサイクル）へアップロードし、
  差分画像を PR コメントに直接埋め込む（reg-suit 第一候補、reg-notify-github-plugin の
  画像埋め込み能力不足なら自前ステップで補完）

## 参照

- インタビュー記録: `intents/ratcap/interviews/storybook-introduction.json`
- ドラフト intent: `intents/ratcap/drafts/storybook-introduction.md`
- 実装: ShuttlePub/shuttlepub-frontends#11 / PR #12（ui-catalog-foundation、2026-09-05 マージ）
- 後続: ui-catalog-visual-diff-ci（backlog）
