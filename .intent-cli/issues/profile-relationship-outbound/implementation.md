# profile-relationship-outbound Implementation Packet

> **親状態の注記**: durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

Profile 単位の Follow/unfollow・個別 block/mute の送信側を実装する。関係変更と配送 job の予約を同一 transaction で行う use case、Profile 鍵による内部署名、lease・再試行・再起動回収を持つ永続配送 worker を提供する。外部配送の失敗がローカルの関係変更を巻き戻さず、非公開の制御 job を公開 outbox へ漏らさない。本番 root router への mount・worker 起動は行わない (P4 が所有)。

## Why

P4 (in-place cutover) が mount・起動するだけで切り替えられるよう、送信側を本番未接続のままテスト構成で完成させておくため。関係状態と配送状態を分離する設計をここで固定し、受信側 (P3i) と D8G/D8R (domain 方針の適用・解除) が同じ配送基盤を使えるようにする。

## Scope

- Profile 単位の Follow/unfollow 送信 use case (Follow 作成と元 Follow activity ID の採番、unfollow は元 Follow を参照する Undo(Follow))
- Profile 単位の個別 block/mute 送信側 use case (block は双方向 Follow 解除を含む関係変更、mute は表示抑制の関係変更のみ)
- 関係変更＋配送 job 予約を同一 transaction で行う仕組み (P2 の enqueue interface を使用)
- Profile 鍵 (P1) による内部署名と HTTP 配送 adapter
- 永続配送 worker: lease 取得、再試行 (backoff・上限)、取消、再起動後の回収、二重 worker 安全性、試行結果の保存
- 非公開制御 job を公開 outbox へ出さない境界
- テスト用に直接組み立てた構成 (本番 router・root main.rs へ接続しない) と fake peer

## Out of scope

- inbound の Follow/Accept/Reject/Undo 受信処理・followers/following の読取 (P3i)
- domain 単位の block/mute・Follow への domain 方針適用 (D8P/D8G/D8R)
- 投稿 Activity の fan-out・配送 (投稿 Activity の認可・実受理は ShuttlePub の後続責務)
- 保存型・migration の新設・本番 migration 採番 (P2/P4)、新しい汎用署名 REST API
- 本番 root router への mount・root からの worker 起動・旧 /ap/accounts/... と旧 Account 版配送の撤去 (P4)
- 旧 Account 単位の関係から Profile 単位への変換・dual-write

## Technical baseline

- E8 確定契約 (Emumet#66 / PR #70、2026-11-10 マージ済み・squash 0bfa437): /api/v1/profiles/{profile_nanoid} 系に follows (POST、DELETE /{follow_id})、following/followers (GET)、blocks/mutes (GET/POST、DELETE /{id})、domain-controls (GET 一覧、GET/PUT/DELETE /{domain}) を OpenAPI タグ ProfilePolicy の 501 スタブ (本番 root router 未 mount) として定義済み。全て現在の所有者のみ、エラーは 401/403/404/409/422/501。followers の応答型は following と分離され、ProfileFollowerResponse.follower は ProfileActorRef (kind: local|remote、actor_url: canonical actor URL で常に必須、profile_id: local のみ)、following は ProfileFollowResponse.target (canonical actor URL)。将来 actor は GET /ap/profiles/{profile_nanoid} (URL 最終形は P1 で確定)。POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username は optional で、形式・予約語違反は 400、有効値は P1 実装まで副作用前に 501、ProfileResponse.username は nullable。schema は server/src/schema/profile_policy.rs と profile_username.rs
- P1〜P3 の新機構は本番 root router に mount せず、新配送 worker も root で起動しない。P4 (profile-federation-in-place-cutover) が一括で mount・旧 route 撤去・worker 起動・本番 migration 採番を所有する
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- username 仕様 (E8 で確定): 形式 ^[a-z0-9][a-z0-9._-]{0,63}$ (ASCII 小文字 1〜64 文字)、暗黙の trim・小文字化なし。予約語 admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known。DB 一意・削除済み再利用なし・Account 名から自動導出しない。段階: E8/P1〜P3 optional → FN で UI 必須送信 → P4 で required
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、AP Block は送らない、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持
- P1 profile-actor-identity-foundation (Emumet#71) が Profile username・actor URI・Profile 鍵 (型と repository)・actor 文書生成を提供する。確定した actor URL 最終形・鍵 repository は P1 closeout で PF に記録される。P1 未マージの間は Emumet#71 の契約に合わせ、曖昧なら issue で質問する
- P2 profile-social-graph-storage (Emumet#72) が固定する保存型・repository port・共通 enqueue interface (P3o/P3i 共通) を使う。P2 の確定形は P2 closeout で host の PF (intents/emumet/features/profile-federation/) に記録される。P2 未マージの間は Emumet#72 の契約に合わせ、型・port が曖昧・不足なら実装を進めず issue で質問する (P2 の型を勝手に拡張・変更しない)
- 署名: Profile 鍵 (P1) で配送 request に HTTP Signature を付ける内部処理とし、新しい汎用署名 API (REST) は作らない。旧 /internal/v1/accounts/{id}/sign と .../public-key (Account 鍵) は変更せず P4 が廃止する。ADR 0003 (委任署名) の鍵所有境界を保つ
- 関係状態と配送状態は別物として扱う: Follow/block/mute などの関係状態 (ローカルの真実) は配送 job の成否に依存しない。配送 job は試行結果 (lease・取消・試行回数・次回時刻・最終結果) だけを持ち、外部配送が失敗・遅延してもローカルの関係変更 (unfollow・block 等) を巻き戻さない
- 個別 actor block/mute の意味は既存 block-mute feature (Account 単位で完了済み) の従来意味を Profile 単位で踏襲する (block は双方向 Follow 解除＋以後の関係操作拒否、mute は表示抑制のみ)。domain 単位の block/mute (完全一致 domain、D8P/D8G/D8R が所有) とは別機能で、本 unit は domain 方針を読まず、混同しない。個別 actor block の Block activity 配送は既存 Account 版の挙動を既定として踏襲し、D08 決定『AP Block は送らない』が個別 actor block にも及ぶかが曖昧な点は実装で独断せず issue で質問する
- 非公開の制御 job (block・mute 由来、配送先限定の job) は公開 outbox (outbox collection 等の公開面) に載せない。配送 job は配送専用の保存であり、公開 outbox の生成元と共有しない
- 現状: Account 単位の outbound は application/src/service/activitypub/outbound_follow.rs と outbox_activities (20260621000004) による配送。Profile 単位の送信 use case・配送 worker は存在しない。既存 Account 版の経路は P4 まで変更しない (dual-write しない)
- 本番 migration は追加しない (P2 の保存型を使う。追加の保存が必要なら P2/P4 と調整し、migration 番号の採番は P4 が所有する)。本番 root router への mount・worker 起動は行わず、テスト用に直接組み立てた構成でのみ検証する

## Acceptance

1. Profile 単位の Follow/unfollow と個別 block/mute の送信 use case があり、関係変更と配送 job の予約が同一 DB transaction で行われる (予約に失敗したら関係変更も残らない／関係変更に失敗したら job が残らない)。関係の主体は Local(ProfileId) で、同一 Account 内の別 Profile や他 Account の Profile に波及しない
2. 外部配送が失敗・timeout してもローカルの unfollow・block は巻き戻らない。unfollow の送信は元 Follow activity ID を参照する Undo(Follow) になる
3. 永続配送 worker が lease で job を取得し、二重 worker の競合でも同一 job を二重配送しない。worker 再起動後に lease 切れ・未完了 job を回収して再試行し、試行回数・次回時刻・最終結果が保存される。取消された job は配送されない
4. 同一 job の重複予約・重複実行が無害 (同じ activity を二度確定的に送らない、または受信側で重複として扱える同一 activity ID を使う)
5. 配送 request は Profile 鍵で署名され、fake peer が署名・宛先 inbox・activity 内容 (actor・object・元 Follow ID) を検証できる
6. 非公開の制御 job が公開 outbox に現れない (公開 outbox を読む経路で job 由来の activity が観測されない) ことをテストで確認する
7. 個別 actor block と domain block を混同しない (本 unit は domain 方針を読まず、domain 完全一致の判定を持たない)。Profile ごとの block/mute が別 Profile の関係に影響しない
8. 本番 root router に route を mount せず、root の main.rs から worker を起動しない。実 root 構成で対象 route が存在しないこと・worker が起動しないことをテストで確認する
9. openapi.json に変更が出る場合は最新 main から再生成し openapi_spec_matches_committed_file が通る。既存 Rust CI が通る

## Verification

実 DB (DATABASE_URL 必須、skip のみ不可) での DB transaction テスト (関係変更＋job 予約の原子性、予約失敗時のロールバック)、fake peer を使った配送テスト (署名検証・宛先・activity 内容・timeout・5xx・再試行)、worker の再起動回収・lease 切れ・二重 worker 競合テスト、非公開 job の公開 outbox 非露出テスト、実 root 構成の route 不在・worker 非起動テスト、cargo fmt / clippy / test。

## Dependencies / Merge order

P1 (Emumet#71) と P2 (Emumet#72) のマージ後に実装をマージする (両方に依存)。P3i (profile-relationship-inbound) とは P2 が固定する enqueue interface を共有し並行可能。E8 (Emumet#66 / PR #70) はマージ済み。共有ファイルの統合は一件ずつ、その時点の main から OpenAPI を再生成する。

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/profile-federation/overview.md (primary)。supporting: intents/emumet/features/personal-domain-controls/overview.md、intents/emumet/features/ap-federation/overview.md、intents/emumet/features/block-mute/overview.md、intents/shuttlepub/packets/candidates.md、intents/shuttlepub/product/social-experience.md ほか`
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: 関係状態と配送状態の区別 (ローカル関係は配送失敗で巻き戻らない)、配送 worker の lease・再試行・回収規則、非公開制御 job の公開 outbox 非露出を PF acceptance.md に記録する
- Closeout writeback expected: yes — 関係状態と配送状態の区別の確定形、配送 worker の lease・再試行・回収パラメータ、署名・配送 adapter の境界、個別 actor block の Block 配送の扱い (質問で確定した場合) (host の `intents/emumet/features/profile-federation/packets.md`、`intents/emumet/features/profile-federation/acceptance.md` へ。host 更新は親が行う)
