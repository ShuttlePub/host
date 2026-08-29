## Goal

ShuttlePub 本体 (Fediverse マイクロブログの SNS 本体) の新規基盤を nitinol (Rust 製 Event Sourcing toolkit) で構築する。Note ドメイン (投稿・reply・turbo・turbo_quote・reaction) のイベントソーシング集約、タイムライン投影 + 取得 REST API、stargate から移植する ActivityPub 連合面 (inbox での Follow 受理 → モック署名による Accept 返送、リモート Actor 解決、HTTPSig 検証)、および Emumet への契約書 (capability 署名 API + post-relay 受け口の要求定義) を 1 実行単位で揃える。対象リポジトリは 2023 年の旧スケルトンからの全面刷新であり、新規 workspace 構成から作る。

## Why This Slice Exists Now

ShuttlePub サービス群の構成として、アカウント・署名鍵・連合中継は Emumet、認証認可は Ory、ファイル保管は Booskiff、タイムライン構築・投稿永続化は ShuttlePub 本体が担う。本体は nitinol ベース (Actor Model + Event Sourcing) で再構成することが決まっており、Emumet 側の capability (shuttlepub-link) / post-relay の実装が本体との接続前提になっている。本 slice はその Emumet 待ちの期間中に、Emumet 非依存部分 (nitinol 基盤、Note ドメイン、連合面、契約書) を実装し、Emumet 完成後に即接続できる土台を作る。

## Current Observed State

`ShuttlePub/ShuttlePub` は 2023-04-30 を最後に停滞している旧スケルトン (独自 Account/Profile/Follow CRUD、signup/login は `todo!()`、投稿・連合・Emumet 連携の実装なし)。本 slice では旧コードは参照しない (全面刷新)。連合面の実装知見は `HalsekiRaika/stargate` (ActivityPub デバッグツール、リレー PoC として Follow 受理→Accept 配送・HTTPSig 署名・検証を実装済み) から移植する。

## Accepted Baseline You May Assume

- Rust (edition 2024、stargate 準拠) + nitinol (ES toolkit、actor runtime 搭載。本体と並行開発中の基盤ライブラリ)。examples (eventsource 1-6、runtime 1-7、saga 1-2) が設計参照
- 永続化は nitinol-persistence 組込の in-memory EventStore / SnapshotStore。postgres アダプタは別リポジトリで実装中であり、本 slice では切り替えない
- axum + OpenAPI 駆動の独自 REST API (Misskey / Mastodon 互換なし)
- ドメイン語彙: ブースト = `turbo`、引用 = `turbo_quote` (AP に公式語がないための独自語として過去から採用。イベント family 名に使用)
- Emumet / Ory / Booskiff との実接続は本 slice では行わない。署名はモック or 自前鍵で仮決めする
- 設計の詳細・根拠はホストリポジトリ ShuttlePub/host の `intents/shuttlepub/` (decisions/2026-08-29-initial-shaping.md D1-D11、interviews/shuttlepub.json grill Q1-Q11) にある

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

Target paths: `kernel/`, `application/`, `driver/`, `server/`, `docs/`

Target part: ShuttlePub 本体の新規基盤 (nitinol ベース ES + Note ドメイン + stargate 由来の連合面)

## In Scope

- workspace 構成: 新規クレート構成で ProcessSystem / EventSourceSystem を起動し、in-memory EventStore / SnapshotStore を配線する
- Note ドメイン: 投稿 (NoteCreated)、reply、turbo、turbo_quote、reaction のイベント (decide / apply) を実装し、in-memory EventStore で永続化・replay を検証する
- タイムライン投影: Projector による read model 構築とタイムライン取得 REST API
- 連合面 (stargate 移植): inbox (Follow 受理 → リモート Actor 照会 → Accept 返送、署名はモック or 自前鍵)、リモート Actor 解決、HTTPSig 検証 (http-msgsign-draft ベース)
- Emumet 契約書 (docs/): capability 署名 API (profile_id + link_id + scopes、sign:post 起点) と post-relay 受け口の要求定義。Emumet の ADR 0002/0003 amended (2026-08-24) 設計を前提に、本体側が要求する API 形を記述する
- CI: 各 aggregate の単体テスト + replay 検証テストが回る構成

## Out Of Scope

- Emumet との実接続 (capability 署名、post-relay 受け口の実装)
- postgres 永続化 (nitinol postgres アダプタ完成後の slice で切换)
- フロントエンド (別リポジトリ)
- 認証・認可 (Ory 連携)。REST API は開発用の簡易オープンでよい
- リレー以外の連合配送 (Create/Note 等の送受信) とタイムラインへの連合投稿反映
- Misskey / Mastodon API 互換レイヤー
- メディア添付 (Booskiff 連携は将来)

## Standalone Child Issue Contract

この issue の PR が届けるもの: (1) nitinol ベースの新規 workspace で ProcessSystem / EventSourceSystem が起動し in-memory イベントストアが使えること、(2) Note ドメイン (投稿・reply・turbo・turbo_quote・reaction) のイベント decide/apply が実装され、永続化・replay が検証されていること、(3) Projector によるタイムライン read model と取得 REST API が動くこと、(4) stargate 由来の連合面 (inbox Follow 受理→Accept 返送、リモート Actor 解決、HTTPSig 検証) が動くこと、(5) Emumet への契約書 (capability 署名 API + post-relay 受け口の要求定義) が docs/ に記録されていること。旧スケルトン (2023 年構成) は全面刷新のため参照不要。署名はモック or 自前鍵でよい。

## Acceptance Criteria

- nitinol ベース workspace で ProcessSystem / EventSourceSystem が起動する
- Note aggregate (投稿・reply・turbo・turbo_quote・reaction) のイベント decide/apply が実装され、in-memory EventStore で永続化・replay が検証される
- Projector によるタイムライン read model が構築でき、取得 REST API が応答する
- 連合面: inbox で Follow を受理しモック署名で Accept を返送、リモート Actor 解決と HTTPSig 検証が動作する (stargate 移植)
- Emumet への契約書 (capability 署名 API + post-relay 受け口の要求定義) が docs/ に記録されている
- 各 aggregate の単体テスト + replay 検証テストが CI で回る

## Verification

1. workspace 起動テスト: ProcessSystem / EventSourceSystem 起動、in-memory store へのイベント永続化
2. Note aggregate 単体テスト: 各イベントの decide/apply、イベント保存後の replay での状態復元
3. タイムライン投影テスト: Projector による read model 更新、REST API 応答
4. 連合面テスト: inbox Follow 受理 → (モック署名) Accept 返送、リモート Actor 解決、HTTPSig 検証 (有効/無効署名)
5. `git diff --check`

## Related Links

- ホスト intent (grill 決定): ShuttlePub/host `intents/shuttlepub/decisions/2026-08-29-initial-shaping.md` (D1-D11)
- 設計基盤: https://github.com/HalsekiRaika/nitinol (ES toolkit、examples が参照実装)
- 連合面の移植元: https://github.com/HalsekiRaika/stargate (AP デバッグツール、リレー PoC)

## Knowledge Maintenance

- Intent placement: `intents/shuttlepub/intent-tree/00-map.md` (実装で確定した構成がずれたら更新)
- ADR candidate: none (decisions/2026-08-29-initial-shaping.md に記録済み)
- Diagram candidate: none
- Docs update: none (Emumet 契約書は成果物として docs/ に含む)
- Closeout writeback expected: yes (technology/overview.md、decisions/2026-08-29-initial-shaping.md への実装で変わった決定の追記)

## Guide Reachability (G645)

- `guide workflow task implementation-loop` → implementation ロール → ShuttlePub/ShuttlePub (kernel/, application/, driver/, server/, docs/)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
