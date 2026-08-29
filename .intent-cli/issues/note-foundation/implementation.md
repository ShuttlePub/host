# note-foundation Implementation Packet

## Goal

ShuttlePub 本体の新規基盤を nitinol ベースで構築する: Note ドメイン
(投稿・reply・turbo・turbo_quote・reaction) のイベントソーシング集約、
タイムライン投影 + 取得 REST API、stargate から移植する連合面
(inbox での Follow 受理 → モック署名による Accept 返送、リモート Actor 解決、
HTTPSig 検証)、および Emumet への契約書 (capability 署名 API + post-relay
受け口の要求定義) を 1 実行単位で揃える。2023 年スケルトンは全面刷新のため、
本 slice は新規 workspace 構成から作る。

## Why

- 2023 年スケルトンは初動 grill で全面刷新が決定 (decisions D1)。既存コードは
  設計意図のアーカイブとして残すのみで、nitinol ベースの新規構成が必要。
- Emumet 側の capability / post-relay 実装が本体の接続前提 (D3) なので、
  待機期間中に Emumet 非依存部分 (D4) を実装する。nitinol は本体と並行開発中の
  基盤ライブラリであり、aggregate / projector / 集約間通信の設計を実コードで
  検証する必要がある。

## Scope

- **workspace 構成**: Rust (edition 2024、stargate 準拠) の新規クレート構成。
  ProcessSystem / EventSourceSystem の起動、in-memory EventStore /
  SnapshotStore (nitinol-persistence 組込) の配線
- **Note ドメイン**: 投稿 (NoteCreated)、reply、turbo、turbo_quote、reaction の
  イベント (decide / apply)。ドメイン語彙は turbo / turbo_quote を維持 (D7)。
  in-memory EventStore への永続化と replay 検証
- **タイムライン投影**: Projector による read model 構築 + タイムライン取得
  REST API (OpenAPI 駆動の独自 REST、Misskey 互換なし)
- **連合面 (stargate 移植)**: inbox エンドポイント (Follow 受理 → リモート
  Actor 照会 → Accept 返送、署名はモック or 自前鍵)、リモート Actor 解決、
  HTTPSig 検証 (http-msgsign-draft ベース)
- **Emumet 契約書** (docs/): capability 署名 API (shuttlepub-link、
  `profile_id + link_id + scopes`、`sign:post` 起点) + post-relay 受け口の
  要求定義。Emumet の既存設計 (ADR 0002/0003 amended 2026-08-24) を前提に、
  本体側が要求する API 形を記述する
- **CI**: 各 aggregate の単体テスト + replay 検証テストが回る構成

## Out of scope

- Emumet との実接続 (capability 署名、post-relay 受け口の実装) — Emumet 側
  完成後の slice (D3)
- postgres 永続化 — nitinol postgres アダプタ (別リポジトリ、実装中) 完成後の
  slice で切换 (D6)
- フロントエンド — 別リポジトリとして後で作る (D9)
- 認証・認可 (Ory 連携) — 初動は未接続。REST API は開発用の簡易オープンでよい
- リレー以外の連合配送 (Create/Note 等の送受信) とタイムラインへの連合投稿反映
- Misskey / Mastodon API 互換レイヤー
- メディア添付 (Booskiff 連携は将来)

## Verification

1. workspace 起動テスト: ProcessSystem / EventSourceSystem が起動し、
   in-memory store にイベントが永続化される
2. Note aggregate 単体テスト: 各イベント (投稿/reply/turbo/turbo_quote/
   reaction) の decide/apply、並びにイベント保存後の replay で状態が復元
   されること
3. タイムライン投影テスト: Projector が read model を更新し、REST API が
   タイムラインを応答する
4. 連合面テスト: inbox Follow 受理 → (モック署名) Accept 返送、リモート
   Actor 解決、HTTPSig 検証 (有効署名/無効署名)
5. `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: `intents/shuttlepub/intent-tree/00-map.md` (初動 shaping の
  書き戻しは packet 作成前に実施済み。実装で確定した構成がずれたら更新)
- ADR candidate: なし (決定は `intents/shuttlepub/decisions/2026-08-29-initial-shaping.md`
  D1-D11 に記録済み。実装で変わった場合は同ファイルに追記)
- Diagram candidate: なし
- Docs update: なし (ユーザードキュメントは運用フェーズ。Emumet 契約書は
  本 slice の成果物だが対象リポジトリ内 docs/ に置く)
- Closeout learning: Note イベント語彙の確定形・連合面の構成・Emumet 契約の
  変更点など、実装で変わった決定を `technology/overview.md` / `decisions/` に
  追記する (`write_back_required: true`)

- Guide reachability (G645): implementation-loop ガイド → implementation ロール
  → ShuttlePub/ShuttlePub (kernel/, application/, driver/, server/, docs/)

`improve` (G456/G460) is the later safety net; packet-time maintenance is the normal path.
