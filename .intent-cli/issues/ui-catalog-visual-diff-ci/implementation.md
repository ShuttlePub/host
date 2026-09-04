# ui-catalog-visual-diff-ci Implementation Packet

## Goal

`apps/ui-catalog` (ui-catalog-foundation) のショーケースを対象に、Playwright でスクリーンショットを
取得し、reg-suit + Cloudflare R2 (S3 互換) によるビジュアル差分パイプラインを既存 CI
(.github/workflows) に統合する。差分画像は R2 にライフサイクルルール付きでアップロードし、
PR コメント上に直接埋め込んで表示する。差分なし PR は緑 check で通る。

## Why

storybook-introduction インタビューで、要件 (1)「CI 経由で PR に結果 (カタログ/ビジュアル差分等) を
載せたい」が確定し、外部ストレージ方式 (Cloudflare R2 + 期限付きアップロード + PR コメントへの
画像直接埋め込み、レポート zip の DL 確認は不可) が確定した。カタログ基盤
(ui-catalog-foundation) の後続として、共有パッケージの見た目変更を PR レビューで即座に
確認できる状態にする。

## Scope

- Playwright によるカタログ各ストーリー/状態のスクリーンショット取得 (JSON manifest の列挙を利用可)
- reg-suit + S3 互換プラグインによる R2 接続と差分検出パイプライン (第一候補)
- PR コメントへの差分画像直接埋め込み: reg-notify-github-plugin の能力を実装時に検証し、不足する場合は自前のアップロード + コメント生成ステップで補完
- R2 アップロードのライフサイクルルール設定 (期限付き自動削除)
- 既存 CI (check.yml、D8 で bun test 追加済みの先例) へのジョブ統合
- 差分なし PR での緑 check 動作

## Out of scope

- カタログアプリ本体の実装 (ui-catalog-foundation の成果物)
- 各アプリ固有 View のスクリーンショット対象化 (初回スコープは共有パッケージのみ)
- R2 バケット/クレデンシャルの発行そのもの (実装リスクとして別途セットアップが必要)

## Verification

- 共有パッケージの見た目変更を含む PR で CI が差分を検出し、R2 上の差分画像が PR コメントに直接表示される
- 差分なし PR で緑 check になる
- R2 オブジェクトにライフサイクル期限が設定されている
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/ratcap/intent-tree/00-map.md` の ui-catalog-visual-diff-ci 行を実装済み状態に更新する (行自体は ui-catalog-foundation 側で追加済みの前提。新規 intent ノードは不要)
- ADR candidate: none (Storybook 不採用の決定記録は ui-catalog-foundation 側の `intents/ratcap/decisions/2026-09-05-ui-catalog-over-storybook.md` に集約。reg-suit/R2 選定はインタビュー確定事項)
- Diagram candidate: none
- Docs update: none (CI 基盤のためユーザー向け docs は対象外)
- Closeout learning: reg-notify-github-plugin の画像直接埋め込み能力の検証結果 (自前ステップ補完の要否) と R2 ライフサイクル運用の知見を `intents/ratcap/technology/overview.md` へ write back する (write_back_required: true)

- Guide reachability (G645): `guide workflow task implementation-loop` (implementation ロール) が
  shuttlepub-frontends リポジトリ (apps/ui-catalog, .github/workflows) へルーティングする。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
