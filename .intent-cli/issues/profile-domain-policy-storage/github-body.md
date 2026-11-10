## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

E8 の domain-controls 契約を実装する。Profile × 正規化 domain の mute/block を実 DB に保存・取得・更新・削除し、revision による競合制御と、現在の所有者のみ操作できる認可を実装する。domain の正規化 (IDNA 等) と照合主体 (検証済み canonical actor ID の host) をここで確定する。

## Why This Slice Exists Now

D8G (新規 Follow の拒否)・D8R (block 設定時の関係解除)・ShuttlePub S8 の表示抑制が参照する domain 方針の保存契約を先に固定するため。正規化と照合主体を後続 unit に分散させず一箇所で確定する。

## Current Observed State

- domain 単位の mute/block は存在しない (既存 block/mute は Account 個別対象)
- E8 で domain-controls route は 501 スタブとして OpenAPI に定義されている (本番未 mount)

## Accepted Baseline You May Assume

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
- E8 確定契約 (Emumet#66 / PR #70、マージ前): /api/v1/profiles/{profile_nanoid} 系に follows (POST、DELETE /{follow_id})、following/followers (GET)、blocks/mutes (GET/POST、DELETE /{id})、domain-controls (GET 一覧、GET/PUT/DELETE /{domain}) を OpenAPI タグ ProfilePolicy の 501 スタブとして定義済み。全て現在の所有者のみ、エラーは 401/403/404/409/422/501。domain-controls の revision は 1 始まりで変更ごとに増加、PUT は expected_revision 省略で新規作成 (既存なら 409)・指定時は一致する場合のみ置換、DELETE は expected_revision 必須 (不一致 409)。将来 actor は GET /ap/profiles/{profile_nanoid} (URL 最終形は P1 で確定)。POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username は optional で、形式不正は 400、有効値は副作用前に 501、ProfileResponse.username は nullable。schema は server/src/schema/profile_policy.rs と profile_username.rs
- P1〜P3 の新機構は本番 root router に mount せず、新配送 worker も root で起動しない。P4 (profile-federation-in-place-cutover) が一括で mount・旧 route 撤去・worker 起動・本番 migration 採番を所有する
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- username 仕様 (E8 で確定): 形式 ^[a-z0-9][a-z0-9._-]{0,63}$ (ASCII 小文字 1〜64 文字)、暗黙の trim・小文字化なし。予約語 admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known。DB 一意・削除済み再利用なし・Account 名から自動導出しない。段階: E8/P1〜P3 optional → FN で UI 必須送信 → P4 で required
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、AP Block は送らない、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持
- domain-controls は E8 で GET 一覧・GET/PUT/DELETE /{domain} が 501 スタブとして定義済み。本 unit はその実装で、契約 (revision は 1 始まり・変更ごとに増加、PUT は expected_revision 省略で新規 (既存なら 409)・指定時一致のみ置換、DELETE は expected_revision 必須で不一致 409) を変えない
- domain の判定基準は検証済み canonical actor ID の host (actor 文書から確認した ID の host)。inbox/CDN/メディア host は判定基準にしない。完全一致で、example.com の設定は sub.example.com へ拡張しない (d08-q09)
- route の mount 方針 (判断): 本 unit では domain-controls route (mute・block ともに) を本番 root router へ mount しない。計画上は block 書込のみ D8R 接続まで未 mount だが、mute のみ先行公開するかどうかは親の判断に委ねる。迷う場合は mount なしで統一する。本番 mount は P4 以降 (block 書込は D8R)
- Follow への適用 (拒否・解除)、投稿・通知・検索の filter は含まない。保存した方針を参照するのは後続の D8G/D8R と ShuttlePub 側

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`
Path: kernel/src/entity/ と kernel/src/repository/ (Profile domain policy の型・正規化・port), driver/src/database/postgres/ (repository), application/src/service/ (domain policy use case・認可), server/src/route/account/ または profile 系 route (domain-controls、本番未 mount), server/src/schema/profile_policy.rs, migrations/ (検証用。本番採番は P4), openapi.json
Part: Profile × 正規化 domain の mute/block の実保存・取得・更新・削除、revision 競合制御、現在の所有者による認可 (E8 の domain-controls 契約の実装)

## In Scope

- Profile × 正規化 domain の mute/block の保存・取得 (一覧・単体)・更新 (PUT)・削除 (DELETE)
- revision: 1 始まり・変更ごとに増加。競合時 409。E8 契約どおりの expected_revision の扱い
- domain の正規化規則 (小文字化・IDNA/Punycode・末尾ドット・ポート等) と正規化表のテスト。完全一致 (サブドメインへ拡張しない)
- 照合主体: 検証済み canonical actor ID の host を判定基準とし、inbox/CDN host を使わない照合関数
- 現在の所有者による認可。Profile 移管後は新所有者のみが操作でき、方針は Profile に付いたまま移管で変わらない
- Profile 分離: 同一 Account の別 Profile、他 Account の Profile の方針は独立
- domain-controls route の実装 (E8 の 501 スタブを実処理へ)。本番 root router へは mount しない

## Out Of Scope

- Follow・Accept・配送への適用 (D8G)、block 設定時の関係解除・job 取消 (D8R)
- 投稿・通知・検索の表示 filter、新規反応・返信・引用・リポストの受理・送信拒否 (ShuttlePub の後続 unit)
- 本番 root router への mount (P4/D8R)、本番 migration 採番 (P4)
- UI (F8)

## Standalone Child Issue Contract

E8 の domain-controls 契約を実装する。Profile × 正規化 domain の mute/block を実 DB に保存・取得・更新・削除し、revision による競合制御と、現在の所有者のみ操作できる認可を実装する。domain の正規化 (IDNA 等) と照合主体 (検証済み canonical actor ID の host) をここで確定する。 本番 root router への mount・新配送 worker のルート起動・本番 migration 採番は行わない (P4 が所有)。受け入れ条件と検証は下記のとおり。

## Acceptance Criteria

1. 完全一致: example.com の方針は sub.example.com に適用されない。正規化後の同一 domain は同じ方針として扱われる
2. 照合は検証済み canonical actor ID の host を基準とし、inbox/CDN/メディア host では判定しない
3. Profile 分離: 同一 Account の別 Profile・他 Account の Profile に方針が波及しない。Profile 移管後は新所有者のみが操作でき、方針は移管後も維持される
4. IDNA・大文字小文字・末尾ドット等の正規化表テストが通り、不正な domain は 422 で拒否される
5. 同時更新・revision 競合: expected_revision 不一致は 409、省略 PUT で既存ありは 409、DELETE は expected_revision 必須。同時 PUT で片方のみ成功する
6. 所有者以外は 403、存在しない Profile/domain は 404、未認証は 401 (E8 契約どおり)
7. domain-controls route は本番 root router に mount されない (route 不在テスト)。block 書込 route は D8R 接続まで未 mount
8. openapi.json を再生成し openapi_spec_matches_committed_file が通る。既存 Rust CI が通る

## Verification

DATABASE_URL を設定した実 DB での保存・取得・更新・削除・revision 競合・同時更新テスト、正規化表テスト、認可 (所有者/非所有者/移管後) テスト、Profile 分離テスト、実 root 構成の route 不在テスト、openapi 再生成と一致テスト、cargo fmt / clippy / test。skip のみで通さない。

## Related Links

- host: intents/emumet/features/personal-domain-controls/ (primary)、intents/emumet/features/profile-federation/、intents/shuttlepub/packets/candidates.md (D08)
- Emumet ADR 0002 / 0003 / 0007、E8: Emumet#66 / PR #70

## Dependencies

E8 (Emumet#66 / PR #70) のマージ後に実装をマージする。P1/P2 とは独立で並行可

## Merge Order

E8 (Emumet#66 / PR #70) のマージ後に実装をマージする。P1/P2 とは独立で並行可。共有ファイル (openapi.rs, route.rs, migrations/, openapi.json) は一件ずつ、その時点の main から openapi.json を再生成して統合する。

## Knowledge Maintenance

- Intent placement: host の `intents/emumet/features/personal-domain-controls/overview.md` (primary)。supporting: intents/emumet/features/profile-federation/overview.md、intents/emumet/features/block-mute/overview.md、intents/shuttlepub/packets/candidates.md ほか
- ADR candidate: なし (domain 正規化・照合主体の確定は DC acceptance.md に記録)
- Diagram candidate: なし
- Docs update: domain 正規化規則・照合主体 (検証済み canonical actor ID の host)・保存契約・revision を DC acceptance.md に確定記録する (host 側。host 更新は親が行う)
- Closeout writeback expected: yes — domain 正規化規則と正規化表、照合主体、保存契約 (revision・認可)、block 書込 route の未 mount 範囲

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → REST API 契約の実装 (/api/v1/profiles/{profile_nanoid}/domain-controls、本番未 mount、openapi.json)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
