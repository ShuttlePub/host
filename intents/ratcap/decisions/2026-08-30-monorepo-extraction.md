# 決定記録: 2026-08-30 モノレポ再編 + Design System packages 抽出 (D1-D8)

Ratcap (ShuttlePub/RatCap) を再編し、ShuttlePub フロントエンド統合モノレポ
`ShuttlePub/shuttlepub-frontends` とした一連の変更の決定記録。経緯:
発端は booskiff の Web スタック検討 (D11/Q16、interviews/booskiff.json 参照)。
本変更は intent-cli ワークフロー (grill/packet) 外の直接依頼として実施され、
本ファイルは事後追記による drift 回復である。GitHub 側は rename のため
旧 URL (ShuttlePub/RatCap) は redirect で継続する。

## 決定一覧

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D1 | repo 名 | `ShuttlePub/RatCap` → `ShuttlePub/shuttlepub-frontends` (GitHub rename、ローカル同名)。将来の ShuttlePub/Booskiff 等フロントを同居させる前提 | 確定 |
| D2 | モノレポ構成 | Bun workspaces 基盤。`apps/emumet-web` (旧 Ratcap 資産の内容不変移動) + `packages/{design-tokens,styles,ui,auth-core,auth-bun}`。Turborepo 等のタスクランナーは導入しない (後回し) | 確定 |
| D3 | 識別子の保持 | 挙動維持のため旧 "ratcap" 名を維持: spago パッケージ名、localStorage キー (`ratcap-color`/`ratcap-shape`)、セッション Cookie 名、Hydra client ID (`ratcap-bff`)、AppId。改名はドメイン帰属決定後の別 slice とする | 確定 |
| D4 | packages 階層 | `design-tokens` (カラー/形状トークン + FOUC 防止 theme.js) → `styles` (Tailwind 入口 CSS) → `ui` (Flame 共通: Theme class 定数、shell primitives `document`/`navBar`/`contentArea`/`navLink`/`notFound`) → `auth-core` (fetch/process.env 非依存の純粋ロジック) + `auth-bun` (Bun HTTP 層、auth-core 依存)。BFF はアプリ別維持、共有は HTTP 非依存ロジックのみ | 確定 |
| D5 | 抽出の検証方針 | 全抽出は挙動保持を原則とし、SSR HTML / style.css / theme.js / auth フローのバイト一致 + テスト計 85 pass (app 44 + auth-bun 41) で検証した | 確定 |
| D6 | spago workspace 所在 | workspace 定義は `apps/emumet-web/spago.yaml` 内に集約 (`packages/ui` は `extraPackages: path:` で接続)。`dev.sh` が `apps/emumet-web/spago.lock` を監視するためルート配置しない。PureScript パッケージが 2 つ目に増えた時点でルート workspace を再検討 | 確定 |
| D7 | phantom deps 対策 | Bun workspaces の isolated リンカーで `spago bundle` (esbuild) が purescript-graphql-client の transitive deps (@urql/core, graphql-ws, wonka) を解決できない問題は、apps/emumet-web/package.json への明示依存追加で根治 (lockfile 再生成では対処しない) | 確定 |
| D8 | CI 強化 | check.yml に `bun test` (apps/emumet-web + packages/auth-bun) を追加。パッケージ分割後のテスト rot を CI で検出 | 確定 |

## 運用知見 (決定に伴う注意事項)

- **Tailwind content detection**: パッケージへコードを移動すると Tailwind v4 の自動スキャンが拾う語彙が変わり `dist/style.css` のバイト一致が崩れる。`apps/emumet-web/src/style.css` の `@source` を packages 配下まで明示的に拡張する必要がある (ui、auth-core、auth-bun の先例。未使用 utility `.fixed`/`.relative` まで再現対象になった実績あり)。
- **tailwind CLI のバージョン**: `bunx @tailwindcss/cli` は最新版を取得し bun.lock 記載版と実際の出力がずれる。バイト比較検証では CLI 版を揃えること。

## 将来 slice に送った論点 (grill で詰める)

- **shuttlepub-frontends のドメイン帰属**: ratcap ドメインのまま維持か、shuttlepub ドメイン (あるいは新ドメイン) への移管か。booskiff web (`apps/booskiff-web`) 実装開始前に grill で決定する
- **execution_unit_regex の narrow 化**: `.intent-cli/issues` root を複数ドメインで共有する現状で ratcap bindings の `.*` は `^ratcap-` 等へ絞るべき (bindings.md 自身の注記通り)。ドメイン帰属決定と同タイミングで対応
- **booskiff web の詳細**: BFF データ経路 (GraphQL BFF 型か core REST プロキシか)、Hydra クライアント/ Cookie 命名、初期スコープ、core との接続解決 (booskiff grill Q16 以降の残課題)

## 移行コミット (shuttlepub-frontends)

- `3e77db5` モノレポ再編本体 / `2c8c9e8` rename 後 docs 更新
- `47133bf` phantom deps + spago workspace 所在の修正
- `db4d7da` design-tokens + styles 抽出
- `65d6578` ui (Theme) 抽出 / `01812ac` ui (shell primitives) 抽出
- `d9ee56d` auth-core + auth-bun 抽出
- `4fc70b0` CI bun test 追加
