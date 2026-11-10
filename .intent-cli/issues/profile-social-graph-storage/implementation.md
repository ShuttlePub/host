# profile-social-graph-storage Implementation Packet

> **親状態の注記**: durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

Profile 単位の social graph を保存するモデルと repository を実装し、P3o (送信側) と P3i (受信側) が使う共通 enqueue interface を固定する。保存対象は Profile 版 Follow、個別 block/mute、元 Follow activity ID、重複受信記録、配送 job (lease・取消・試行結果)。あわせて P4 が本番 migration 化する前提として、旧連合データだけを初期化する SQL を隔離 DB 用 fixture として検証する。

## Why

P3o/P3i が同じ保存型・enqueue interface に依存して並行できるようにし、P4 の破壊的 SQL の対象範囲を、本番 migration に置く前に隔離 DB で確定・検証するため。

## Scope

- Profile 版 Follow の保存 (`Local(ProfileId)` を関係主体とし、Profile ごとに関係を分離)。元 Follow activity ID を保持し、同じ相手との Follow の世代を activity ID で区別
- Profile 版の個別 (Account/actor 単位) block/mute の保存と取得
- 重複受信記録 (同一 activity の再受信を検知する保存)
- 配送 job の保存モデル: lease、取消、試行結果 (回数・最終結果・次回時刻等)。競合する worker の取り合いが安全であること
- P3o/P3i が使う共通 enqueue interface (型・port) の固定
- in-place reset SQL の隔離 DB 用 fixture: 旧連合データだけを初期化し非対象データを保持することの検証。対象一覧は PF に記録して P4 へ渡す

## Out of scope

- 本番 migrations/ への配置・採番 (P4)
- dual-write、旧 Account 単位データから Profile 単位データへの変換ツール
- 実配送 worker・HTTP 配送・署名 (P3o)、inbox 受信処理 (P3i)
- domain 単位の方針保存 (D8P)、Follow への domain 方針適用 (D8G/D8R)
- 本番 root router への mount・worker 起動

## Technical baseline

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
- E8 確定契約 (Emumet#66 / PR #70、マージ前): /api/v1/profiles/{profile_nanoid} 系に follows (POST、DELETE /{follow_id})、following/followers (GET)、blocks/mutes (GET/POST、DELETE /{id})、domain-controls (GET 一覧、GET/PUT/DELETE /{domain}) を OpenAPI タグ ProfilePolicy の 501 スタブとして定義済み。全て現在の所有者のみ、エラーは 401/403/404/409/422/501。domain-controls の revision は 1 始まりで変更ごとに増加、PUT は expected_revision 省略で新規作成 (既存なら 409)・指定時は一致する場合のみ置換、DELETE は expected_revision 必須 (不一致 409)。将来 actor は GET /ap/profiles/{profile_nanoid} (URL 最終形は P1 で確定)。POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username は optional で、形式不正は 400、有効値は副作用前に 501、ProfileResponse.username は nullable。schema は server/src/schema/profile_policy.rs と profile_username.rs
- P1〜P3 の新機構は本番 root router に mount せず、新配送 worker も root で起動しない。P4 (profile-federation-in-place-cutover) が一括で mount・旧 route 撤去・worker 起動・本番 migration 採番を所有する
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- username 仕様 (E8 で確定): 形式 ^[a-z0-9][a-z0-9._-]{0,63}$ (ASCII 小文字 1〜64 文字)、暗黙の trim・小文字化なし。予約語 admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known。DB 一意・削除済み再利用なし・Account 名から自動導出しない。段階: E8/P1〜P3 optional → FN で UI 必須送信 → P4 で required
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、AP Block は送らない、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持
- 現状: follows/blocks/mutes は Account 単位 (migrations/20230707210300_init.sql の follows、20260722000001_add_blocks_and_mutes.sql)、outbox_activities (20260621000004) は Account 単位の配送。remote_accounts は旧連合 identity。Profile 単位の関係保存は存在しない
- 本番 migration は追加しない。migration 番号の採番と本番配置は P4 が所有する。本 unit の SQL は独立 DB／schema の検証用 fixture として置き、本番 migrations/ ディレクトリに追加しない
- 初期化 (in-place reset) は旧連合 identity に属するデータだけを対象にする。TRUNCATE ... CASCADE は禁止 (FK 経由で AuthAccount・Account・Profile 等を巻き込むため)。対象テーブルを明示列挙した DELETE/TRUNCATE (CASCADE なし) のみ使う

## Acceptance

1. `Local(ProfileId)` を関係主体として Follow・個別 block/mute を保存し、同一 Account 内の別 Profile、他 Account の Profile の関係が分離される
2. Follow の世代を元 Follow activity ID で区別でき、同じ相手への再 Follow が別世代として保存される
3. 配送 job の lease・取消・試行結果を保存でき、複数 worker の競合で二重取得されない
4. 重複受信を記録・検知できる
5. 旧連合データだけを初期化する fixture を独立 DB/schema で実行し、非対象データ (AuthAccount、Account、Profile、組織 membership、イベント履歴、全体モデレーション) が保持される。TRUNCATE ... CASCADE を使わない
6. P3o・P3i が共通に使う enqueue interface (型・port) が固定され、PF に記録される
7. 本番 migrations/ にファイルを追加しない。本番 root router・worker に変更を加えない
8. 既存 Rust CI が通る (openapi.json に変更がなければ再生成不要)

## Verification

独立 DB/schema での migration・repository・競合 (lease の同時取得、同時 Follow 世代作成) テスト、初期化 fixture 前後の保持データ照合テスト (非対象データの件数・内容が不変)、TRUNCATE CASCADE 不使用の確認、cargo fmt / clippy / test。DATABASE_URL を設定し skip のみで通さない。

## Dependencies / Merge order

E8 (Emumet#66 / PR #70) のマージ後に実装をマージする。P1 とは独立で並行可。E8 (Emumet#66 / PR #70) のマージ後に実装をマージする。P1 とは独立で並行可。本番 migration は追加しないため migrations/ の競合はないが、共有ファイルの統合は一件ずつ、その時点の main から行う。

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/profile-federation/overview.md` (primary)。supporting は intents/emumet/features/personal-domain-controls/overview.md、intents/emumet/features/ap-federation/overview.md、intents/emumet/features/block-mute/overview.md、intents/shuttlepub/packets/candidates.md、intents/shuttlepub/product/social-experience.md、intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json、intents/emumet/decisions/0002-account-address-on-emumet-domain.md、intents/emumet/decisions/0003-delegated-signing.md、intents/emumet/decisions/0007-organization-accounts.md
- ADR candidate: なし (P4 の profile-federation-in-place-reset ADR は P4 で新設)
- Diagram candidate: なし
- Docs update: 保存項目、enqueue interface、P4 へ渡す初期化対象一覧 (対象/非対象) を PF acceptance.md に記録する
- Closeout writeback expected: yes — 保存項目、共通 enqueue interface の確定形、旧連合データ初期化の対象一覧 (P4 へ渡す) (host の intents/emumet/features/profile-federation/packets.md、intents/emumet/features/profile-federation/acceptance.md へ。host 更新は親が行う)
