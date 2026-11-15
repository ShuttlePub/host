# shuttlepub-web-real-e2e-public-emumet Implementation Packet

## Goal

`shuttlepub-real-e2e` ジョブを `EMUMET_READ_TOKEN` なしで毎回実行する。公開 Emumet を pin した revision で checkout し、実スタック E2E を PR ごとに走らせる。

## Why

Emumet は公開リポジトリで鍵は不要。鍵未設定で skip したまま緑になり、実 Emumet 認証が検証済みに見える状態を解消する。ジョブは CI で未実行のため、有効化で失敗が露見したら同じ PR で直す (難しい・範囲が広がるなら止めて報告)。

## Scope

- e2e.yml: `EMUMET_AVAILABLE` / skip ステップ / checkout token の削除、全ステップ無条件化
- AUTH.md の鍵・skip 記述の修正
- 有効化で露見する CI 上の失敗の修正
- e2e マトリクス real モード (Booskiff) の実態調査と PR 本文での報告

## Out of scope

- Booskiff の鍵の扱いの変更、E2E の試験範囲拡張、Emumet 側の変更

## Verification

e2e-real.sh のローカル実行 (Docker)、PR の CI (shuttlepub-real-e2e が skip でなく実行されたログ)、`git diff --check`。

## Knowledge Maintenance (G461, optional)

- Intent placement: 新規ノード不要。
- ADR candidate: none.
- Diagram candidate: none.
- Docs update: candidates.md の real E2E skip の既知事情を解消として更新。
- Closeout learning: 有効化で見つかった失敗と修正、e2e マトリクス real の実態。write_back_required: true.
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (.github/workflows/e2e.yml、apps/shuttlepub-web)。
