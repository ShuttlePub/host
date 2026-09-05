# ratcap technology overview

Target repo: `ShuttlePub/shuttlepub-frontends`（Bun workspaces モノレポ。2026-08-30 モノレポ再編 D1-D8:
`intents/ratcap/decisions/2026-08-30-monorepo-extraction.md` 参照）。

## スタック

- アプリ: `apps/{emumet-web, booskiff-web, ui-catalog}` — PureScript 0.15 + Flame（SSR + hydration）+ Bun サーバー + Tailwind v4
- 共有パッケージ: `packages/{design-tokens, styles, ui, auth-core, auth-bun}`

## 運用知見（closeout writeback）

### 2026-09-05 ui-catalog-foundation (PR #12) からの writeback

- **spago workspace はアプリ側 spago.yaml に集約 + extraPackages `path:` 参照で動作確認済み**
  （D6 の再検討条件への回答: 3 アプリ目でもこの方式で問題なく動く。ルートに spago.yaml は置かない）
- **Tailwind v4 は `src/style.css` の `@source` を `packages/ui/src` まで明示拡張することが必須**
  （`@source "../../../packages/ui/src/**/*.purs"`。外すと共有パッケージのクラス収集が崩れる。
  booskiff-web と同一行で踏襲）
- manifest の二重ソース（TS 側 `manifest.ts` / PureScript 側 `Catalog.purs`）は
  `manifest.test.ts` と `test/Test/Main.purs` が同一 URL リストにピン留めし、CI で乖離検出する設計が有効
