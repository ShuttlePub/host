# drive-web-ui Implementation Packet

## Goal

Booskiff の最小 Web UI を shuttlepub-frontends モノレポの `apps/booskiff-web` として新設する。
PureScript + Flame で SSR + hydration された Drive 画面 (ログイン、ファイル/フォルダ一覧、
アップロード、ダウンロード、削除) と、認証・セッション・core 中継を担う Bun BFF を実装し、
drive-foundation (Rust core) の REST API をブラウザから利用可能にする。

## Why

grill Q16 (D11 反転) で Web スタックが PureScript + Flame (SSR + hydration) + Bun BFF に確定し、
配置が shuttlepub-frontends モノレポの apps/booskiff-web に決まった。当初 D14 では core + web
最小限を 1 実行単位に含める計画だったが、drive-foundation の packet 改訂 (2026-08-30) で
core-only に分離され、web は後続ユニット drive-web-ui として切り出された。core の課金・ストレージ
ドメイン (D1-D21) が揃った後に、ブラウザから Drive を操作するための最小 UI を実装する。

## Scope

- `apps/booskiff-web` Flame アプリ: SSR + hydration、ログイン画面、Drive 一覧 (ファイル + フラットフォルダ)、アップロード (進捗表示付き)、ダウンロード、削除、フォルダ CRUD、クォータ表示
- Bun BFF: OAuth/OIDC フロー (Kratos/Hydra 連携、Ratcap bff/ ロジックの移植)、HTTP-only Cookie セッション、トークン更新、セッション→JWT 変換して core を内部呼び出し
- モノレポ配線: workspace 登録、ビルド/開発スクリプト
- Web E2E (Playwright、D15): core + MinIO + Postgres + web の compose 上でシナリオ実行

## Out of scope

- サムネイル・画像変換 (D16、後続 slice。file レコードは派生オブジェクト許容設計)
- 共有 (輸送) (D9、後続 slice)
- 組織アカウント管理 UI (D19、後続 slice)
- 管理者 UI (管理者 API 本体は core / drive-foundation 側)
- 決済プロバイダ実装 (D8、env 抽象化のみ前提)
- Misskey 互換 API (D10 で棄却済み)

## Verification

- PureScript コンパイル・ビルドが通る (spago build / bun による production build)
- BFF 単体テスト (セッション管理・JWT 変換・core 中継のモックテスト)
- Playwright Web E2E が compose 環境 (core + MinIO + Postgres + web) でグリーン
- `git diff --check`

## Knowledge Maintenance (G461)

- Intent placement: `intents/booskiff/intent-tree/00-map.md` の drive-web-ui 行を更新 (新規 intent 不要)。
- ADR candidate: なし (D11/Q16 は decisions/2026-08-29-initial-shaping.md に記録済み)。
- Diagram candidate: なし (technology/overview.md の構成図で十分)。
- Docs update: なし (初動 slice。self-hosting 手順は drive-foundation 側)。
- Closeout learning: Flame SSR + hydration × Bun BFF での実装上の知見 (ページ構成、hydration 境界、セッション管理方式) を `technology/overview.md` へ書き戻す (`write_back_required: true`)。
- Guide reachability: `guide workflow task implementation-loop` (implementation) → shuttlepub-frontends リポジトリ (apps/booskiff-web)。
