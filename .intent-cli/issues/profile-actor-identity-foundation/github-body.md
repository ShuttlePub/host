## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

Profile を AP actor の主体にするための identity 基盤を実装する。(1) username の実保存 (E8 で 501 を返していた作成時の username 指定を保存に切り替え、旧 payload 省略も引き続き受理) と、未設定 Profile への所有者による一回限り設定、(2) Profile actor 情報・鍵の型と repository、(3) WebFinger／actor 文書の生成ロジック。いずれも本番 root router へは mount せず、本番 actor 公開・新規署名 API・旧 identity 変換は含めない。

## Why This Slice Exists Now

後続の P3o/P3i (Profile 単位の送受信)、FN (UI の username 入力・一回限り設定)、P4 (切替) が参照する identity の型と保存を先に固定するため。username は DB 一意・削除済み再利用なしで、Profile 移管でも変わらないことを実 DB で保証する。

## Current Observed State

- POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username は E8 で optional だが、有効値を指定すると副作用前に 501 を返し、保存されない
- Profile の読取表現 (ProfileResponse.username) は nullable で、現状は常に未設定
- AP actor・署名鍵は Account 単位 (signing_keys.account_id)。Profile 単位の actor 情報・鍵は存在しない

## Accepted Baseline You May Assume

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
- E8 確定契約 (Emumet#66 / PR #70、マージ前): /api/v1/profiles/{profile_nanoid} 系に follows (POST、DELETE /{follow_id})、following/followers (GET)、blocks/mutes (GET/POST、DELETE /{id})、domain-controls (GET 一覧、GET/PUT/DELETE /{domain}) を OpenAPI タグ ProfilePolicy の 501 スタブとして定義済み。全て現在の所有者のみ、エラーは 401/403/404/409/422/501。domain-controls の revision は 1 始まりで変更ごとに増加、PUT は expected_revision 省略で新規作成 (既存なら 409)・指定時は一致する場合のみ置換、DELETE は expected_revision 必須 (不一致 409)。将来 actor は GET /ap/profiles/{profile_nanoid} (URL 最終形は P1 で確定)。POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username は optional で、形式不正は 400、有効値は副作用前に 501、ProfileResponse.username は nullable。schema は server/src/schema/profile_policy.rs と profile_username.rs
- P1〜P3 の新機構は本番 root router に mount せず、新配送 worker も root で起動しない。P4 (profile-federation-in-place-cutover) が一括で mount・旧 route 撤去・worker 起動・本番 migration 採番を所有する
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- username 仕様 (E8 で確定): 形式 ^[a-z0-9][a-z0-9._-]{0,63}$ (ASCII 小文字 1〜64 文字)、暗黙の trim・小文字化なし。予約語 admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known。DB 一意・削除済み再利用なし・Account 名から自動導出しない。段階: E8/P1〜P3 optional → FN で UI 必須送信 → P4 で required
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、AP Block は送らない、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持
- 現状: Account 単位 actor が前提。署名鍵 signing_keys は account_id 紐付け、AP route は /ap/accounts/... と /.well-known/webfinger (server/src/route/activitypub/)、署名 API は /internal/v1/accounts/{id}/sign と .../public-key。Profile は username を持たない。ADR 0002 は 1 Profile = 1 actor を採用済みだが実装は未追従
- 新設 ADR intents/emumet/decisions/profile-actor-identity.md は ADR 0002 (AP actor は Profile 単位) の実装確定、ADR 0007 (Profile 移管は Account 変換ではなく Profile 単位) と整合する identity 所有主体の規則を記録する。host 側の ADR は親が新設済みで、本 unit は実装で確定した細部 (actor URL 最終形、鍵保存形式、一回限り設定の競合規則) を closeout で write-back する
- 一回限り設定: 所有者が username 未設定の Profile に一度だけ設定できる。設定後は変更不可。username を通常の編集機能 (PATCH 等) として公開しない

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`
Path: kernel/src/entity/profile/ (username 型・actor 情報・鍵), kernel/src/repository/, driver/src/database/postgres/ (profile repository・Profile 鍵 repository), application/src/service/profile.rs と account 作成 use case, server/src/route/account/mod.rs (username 保存への切替), server/src/route/activitypub/ (生成ロジックのみ・本番未 mount), migrations/ (検証用。本番採番は P4), openapi.json
Part: Profile 単位 identity の基盤: username の実保存・一回限り設定、Profile actor 情報・鍵の型と repository、WebFinger／actor 文書の生成 (本番未公開)

## In Scope

- Profile username の値型 (形式・予約語検証)、DB 一意制約 (削除済み再利用なし)、実保存、イベント再適用での復元
- 作成時 username の保存 (POST /api/v1/accounts の profile_username、POST /api/v1/profiles の username)。E8 の 501 を保存に切替。省略した旧 payload は従来どおり受理
- 所有者が未設定の Profile に一度だけ username を設定する use case と (本番未 mount または既存契約の範囲の) route。設定済みは拒否 (409 相当)。通常の編集 API は設けない
- Profile actor 情報 (actor URI、inbox/outbox 等の URL 組立) と Profile 鍵 (所有主体は Profile) の型と repository
- WebFinger／actor 文書の生成ロジック (本番未公開。生成関数と実 DB を使う検証のみ)。actor URL の最終形をここで確定し、E8 契約の GET /ap/profiles/{profile_nanoid} と整合させる
- 新 identity 処理の実 DB 検証

## Out Of Scope

- 本番 Profile actor の公開 (本番 /ap/profiles/... mount)、新配送 worker の起動 (P4)
- 新しい汎用署名 API (/internal/v1 配下に Profile 用署名 API を新設しない。内部署名は P3o が必要に応じて扱う)
- 旧 Account 単位 identity の変換・移行 (旧連合データの初期化と新 Profile 鍵の一回限り生成は P4)
- Follow・block/mute・配送 job の保存 (P2)、関係処理 (P3o/P3i)、domain 方針 (D8P)
- UI (FN)、username 必須化 (P4)

## Standalone Child Issue Contract

Profile を AP actor の主体にするための identity 基盤を実装する。(1) username の実保存 (E8 で 501 を返していた作成時の username 指定を保存に切り替え、旧 payload 省略も引き続き受理) と、未設定 Profile への所有者による一回限り設定、(2) Profile actor 情報・鍵の型と repository、(3) WebFinger／actor 文書の生成ロジック。いずれも本番 root router へは mount せず、本番 actor 公開・新規署名 API・旧 identity 変換は含めない。 本番 root router への mount・新配送 worker のルート起動・本番 migration 採番は行わない (P4 が所有)。受け入れ条件と検証は下記のとおり。

## Acceptance Criteria

1. 旧作成 payload (username 省略) は従来どおり受理される。新 payload の username は保存され、Account と Profile の同時作成 (profile_username) でも同時設定できる
2. 重複 username・予約語・形式違反は拒否され、一意性は DB 制約で保証される (競合する同時設定でも片方のみ成功)。削除済み Profile の username は再利用できない
3. 所有者は未設定 Profile に username を一度だけ設定でき、設定済み Profile への再設定は拒否される。所有者以外は設定できない
4. Profile 移管で username・将来 actor URI・鍵の所有主体が変わらない
5. Profile username の保存がイベント再適用で復元される (イベント履歴から projection を再構築しても同じ username になる)
6. Profile 鍵による署名が検証でき、WebFinger／actor 文書の生成結果が Profile 単位の acct・actor URI・公開鍵を指す
7. 実 root 構成で本番 /ap/profiles/... が mount されておらず、新配送 worker が root で起動しないことを route 不在テストで確認する
8. username 設定を除き、新 actor・Profile 鍵の本番生成を開始しない
9. openapi.json を再生成し openapi_spec_matches_committed_file が通る (E8 の 501 記述が保存に変わった差分のみ)。既存 Rust CI が通る

## Verification

DATABASE_URL を設定した実 DB での username 保存・一意・一回限り設定・同時競合テスト、イベント再適用テスト、Profile 移管テスト、鍵署名・検証テスト、WebFinger／actor 文書生成テスト、実 root 構成の route 不在テスト、openapi 再生成と一致テスト、cargo fmt / clippy / test。

## Related Links

- host: intents/emumet/features/profile-federation/ (primary)、intents/emumet/features/personal-domain-controls/、intents/shuttlepub/packets/candidates.md (D08)
- 新設 ADR: intents/emumet/decisions/profile-actor-identity.md
- Emumet ADR 0002 / 0003 / 0007、E8: Emumet#66 / PR #70

## Dependencies

E8 (Emumet#66 / PR #70) のマージ後に実装をマージする (契約が確定するまで schema を先行固定しない)

## Merge Order

E8 (Emumet#66 / PR #70) のマージ後に実装をマージする。P2 とは独立で並行可。共有ファイルの統合は一件ずつ、その時点の main から openapi.json を再生成する。

## Knowledge Maintenance

- Intent placement: host の `intents/emumet/features/profile-federation/overview.md` (primary)。supporting: intents/emumet/features/personal-domain-controls/overview.md、intents/emumet/features/ap-federation/overview.md、intents/shuttlepub/packets/candidates.md ほか
- ADR candidate: 新設済み: intents/emumet/decisions/profile-actor-identity.md (Profile actor identity。ADR 0002/0007 との関係を記録)。実装確定値を closeout で write-back
- Diagram candidate: なし
- Docs update: username 保存・一回限り設定・actor URL 最終形・鍵所有主体の確定を PF acceptance.md に記録する (host 側。host 更新は親が行う)
- Closeout writeback expected: yes — actor URL 最終形、Profile 鍵の保存形式・所有主体、username 一回限り設定の競合規則、イベント再適用の扱い

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → REST API (POST /api/v1/accounts、POST /api/v1/profiles、username 一回限り設定、openapi.json)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
