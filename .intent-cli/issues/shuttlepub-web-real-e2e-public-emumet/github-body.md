## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。frontends 側に親状態を作成しない。

## Goal

`.github/workflows/e2e.yml` の `shuttlepub-real-e2e` ジョブを、`secrets.EMUMET_READ_TOKEN` なしで毎回実行する。本物の Emumet (公開リポジトリ) を pin した revision で checkout し、Kratos / Hydra / Emumet / BFF の実スタックに対する Playwright E2E を PR ごとに走らせる。

## Why This Slice Exists Now

ジョブは `secrets.EMUMET_READ_TOKEN` が空だと E2E 全体を skip し、skip したまま緑になる。Emumet は公開リポジトリ (ユーザーが確認済み) なので鍵は不要で、鍵が無いまま『実 Emumet 認証が検証済み』に見える状態が続いている。このジョブは CI で一度も実行されていない。

## Current Observed State

- `shuttlepub-real-e2e` は `EMUMET_AVAILABLE: ${{ secrets.EMUMET_READ_TOKEN != '' }}` で全ステップを条件付けし、空なら `echo "SKIPPED ..."` だけ実行する
- Emumet の checkout に `token: ${{ secrets.EMUMET_READ_TOKEN }}` を渡している
- `apps/shuttlepub-web/AUTH.md` に「private checkout 用 `EMUMET_READ_TOKEN` 不在なら明示的に skip」「private checkout 不要で常時 CI 実行 (cookie-isolation)」の記述がある
- `e2e/emumet-revision` は ef82462a1ac29786701f07feed12e9efe7236f30 (Emumet main は現在 c4d6ea3)
- `e2e` マトリクスの real モード (booskiff-web) は別の鍵 `BOOSKIFF_READ_TOKEN` に依存する (調査対象)

## Accepted Baseline You May Assume

- ShuttlePub/Emumet は公開リポジトリで未ログインでも読める (ユーザー確認済み)
- 実 E2E の中身 (`e2e-real.sh`、`e2e/compose.yml`、テスト) は frontends PR #32 で導入済み。ローカルでは実行できる想定だが CI では未実行
- action は commit SHA pin、`permissions: contents: read` を維持する
- マージは独立レビュー後にリードが指示する

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`

- Target paths: `.github/workflows/e2e.yml`, `apps/shuttlepub-web` (AUTH.md、必要なら e2e-real.sh / e2e/)

Target part: `shuttlepub-real-e2e の skip 条件と token の除去、有効化で露見する失敗の修正`

## In Scope

- `EMUMET_AVAILABLE` による skip と skip ステップの削除、Emumet checkout の token 指定の削除 (全ステップを無条件に実行)
- 有効化して CI で失敗した場合の原因修正 (同じ PR)
- AUTH.md など workflow が参照するドキュメント・スクリプトの鍵に関する記述の修正
- e2e マトリクス real モードが本物の Booskiff core に繋がっているか・何を試験しているかの調査と報告 (PR 本文)

## Out Of Scope

- Booskiff 側 (`BOOSKIFF_READ_TOKEN`、e2e マトリクス) の鍵の扱いの変更 (調査結果の報告のみ。変更が必要なら理由を添えて別 unit)
- 実 E2E の試験範囲の拡張、Emumet 側の変更
- 直すのが難しい・範囲が広がる失敗 (止めて報告する)

## Standalone Child Issue Contract

`shuttlepub-real-e2e` から `EMUMET_READ_TOKEN` への依存 (skip 判定と checkout token) を除き、公開 Emumet を pin した revision で毎回 checkout して実スタック E2E を実行する。有効化して CI で失敗する場合は同じ PR で直す。範囲が広がる・直すのが難しい場合は止めて報告する。PR 本文に、変更内容、CI 結果、ジョブが skip ではなく実際に動いた証拠、e2e マトリクス real モードの調査結果を書く。

## Acceptance Criteria

1. `shuttlepub-real-e2e` が `secrets.EMUMET_READ_TOKEN` なしで毎回実行される (skip ステップ・`EMUMET_AVAILABLE`・checkout の token 指定が無い)。
2. CI 上で shuttlepub-real-e2e が実際に Playwright を実行して成功する。ジョブログの実行結果 (passed 件数) を PR 本文に載せる。失敗時の原因は同じ PR で直す。直すのが難しい・範囲が広がる場合は止めて報告する。
3. AUTH.md の鍵・private checkout・skip の記述が実態に合う。
4. e2e マトリクス real モードの実態 (実 Booskiff core に繋がっているか、何を試験するか、変更要否) を PR 本文で報告する。
5. 既存 CI (check・visual・cookie-isolation・e2e マトリクス) が劣化せず、PR は未マージで CI がグリーン。

## Verification

`e2e-real.sh` のローカル実行 (Docker 必須、使ったコンテナは片付ける)、PR の CI (shuttlepub-real-e2e のログ確認)、`git diff --check`。

## Related Links

- 導入元: ShuttlePub/shuttlepub-frontends#32 (shuttlepub-web-emumet-auth)
- 既知事情の記録: host `intents/shuttlepub/packets/candidates.md` (real E2E は EMUMET_READ_TOKEN 未設定で skip)

## Knowledge Maintenance

- Intent placement: 新規ノード不要 (CI 運用の修正)
- ADR candidate: none
- Diagram candidate: none
- Docs update: candidates.md の『real E2E は skip』の既知事情を解消として更新し、有効化で見つかった失敗と e2e マトリクス real の調査結果を記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (.github/workflows/e2e.yml、apps/shuttlepub-web)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
