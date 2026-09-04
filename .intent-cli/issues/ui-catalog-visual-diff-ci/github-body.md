## Goal

`apps/ui-catalog` (ui-catalog-foundation の成果物) のショーケースを対象に、Playwright で
スクリーンショットを取得し、reg-suit + Cloudflare R2 (S3 互換) によるビジュアル差分
パイプラインを既存 CI (.github/workflows) に統合する。差分画像は R2 にライフサイクルルール
付きでアップロードし、PR コメント上に直接埋め込んで表示する。差分なし PR は緑 check で通る。

## Why This Slice Exists Now

要件「CI 経由で PR に結果 (カタログ/ビジュアル差分等) を載せたい」がインタビューで確定し、
外部ストレージ方式 (Cloudflare R2 + 期限付きアップロード + PR コメントへの画像直接埋め込み、
レポート zip の DL 確認は不可) が確定した。カタログ基盤 (ui-catalog-foundation) の後続として、
共有パッケージの見た目変更を PR レビューで即座に確認できる状態にする。

## Current Observed State

- ui-catalog-foundation により `apps/ui-catalog` と JSON manifest (ストーリー/状態/URL 列挙) が存在する前提 (依存ユニット)
- 既存 CI は check.yml に `bun test` まで追加済み (D8)。ビジュアル差分の仕組みは存在しない
- R2 バケット/クレデンシャルは未発行 (実装リスク、後述)

## Accepted Baseline You May Assume

- 対象はカタログが列挙する共有パッケージのストーリー/状態のみ (アプリ固有 View は含めない)
- Cloudflare R2 (S3 互換) へ差分画像・レポートを期限付き (ライフサイクルルールで自動削除) でアップロードする。レポート zip の DL 確認は不可
- reg-suit (S3 互換プラグインで R2 接続) を第一候補とする。PR コメントへの画像直接埋め込みは reg-notify-github-plugin の能力を実装時に検証し、不足する場合は自前のアップロード + コメント生成ステップで補完する
- 既存 CI (check.yml) にジョブとして統合する (D8 の bun test 追加の先例)

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `apps/ui-catalog, .github/workflows`

Target part: "UI カタログのビジュアル差分パイプライン (Playwright + reg-suit + Cloudflare R2) と既存 CI への統合"

## In Scope

- Playwright によるカタログ各ストーリー/状態のスクリーンショット取得 (JSON manifest の列挙を利用可)
- reg-suit + S3 互換プラグインによる R2 接続と差分検出パイプライン
- PR コメントへの差分画像直接埋め込み (reg-notify-github-plugin 検証、不足時は自前ステップで補完)
- R2 アップロードのライフサイクルルール設定 (期限付き自動削除)
- 既存 CI (check.yml) へのジョブ統合と差分なし PR の緑 check

## Out Of Scope

- カタログアプリ本体の実装 (ui-catalog-foundation の成果物)
- 各アプリ固有 View のスクリーンショット対象化
- R2 バケット/クレデンシャルの発行そのもの (運用セットアップとして別途実施)

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: shuttlepub-frontends リポジトリの CI に、
`apps/ui-catalog` のカタログを Playwright で撮影し reg-suit でビジュアル差分を検出する
パイプラインを追加すること。共有パッケージ (packages/ui / design-tokens / styles) の
見た目変更を含む PR で、差分画像が Cloudflare R2 (ライフサイクル期限付き) にアップロードされ、
PR コメントに画像が直接埋め込まれて表示されること (zip DL 方式は不可)。差分なし PR では
緑 check になること。

## Acceptance Criteria

- 共有パッケージ (packages/ui / design-tokens / styles) の見た目変更を含む PR で CI がスクリーンショット差分を検出し、R2 にアップロードされた差分画像が PR コメントに直接表示される
- 差分なし PR では緑 check になる

## Implementation Risks

- R2 バケット/クレデンシャル/ライフサイクルルールのセットアップが前提として必要
- reg-notify-github-plugin が PR コメントへの画像直接埋め込みに対応しているかは実装時に要検証。非対応の場合は自前のアップロード + PR コメント生成ステップで補完する

## Verification

- 見た目変更を含む PR で CI が差分を検出し、R2 上の差分画像が PR コメントに直接表示される
- 差分なし PR で緑 check になる
- R2 オブジェクトにライフサイクル期限が設定されている
- `git diff --check`

## Related Links

- 先行ユニット: ui-catalog-foundation (カタログアプリ基盤)
- インタビュー記録: `intents/ratcap/interviews/storybook-introduction.json`
- ドラフト intent: `intents/ratcap/drafts/storybook-introduction.md`
- モノレポ決定記録 (D1-D8): `intents/ratcap/decisions/2026-08-30-monorepo-extraction.md`
- マップ: `intents/ratcap/intent-tree/00-map.md`

## Knowledge Maintenance

- Intent placement: `intents/ratcap/intent-tree/00-map.md` の ui-catalog-visual-diff-ci 行を実装済みに更新 (新規 intent 不要)
- ADR candidate: none (Storybook 不採用の決定記録は ui-catalog-foundation 側に集約)
- Diagram candidate: none
- Docs update: none (CI 基盤)
- Closeout writeback expected: yes (reg-notify-github-plugin 検証結果と R2 ライフサイクル運用の知見を `intents/ratcap/technology/overview.md` へ)

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が
shuttlepub-frontends リポジトリ (apps/ui-catalog, .github/workflows) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
