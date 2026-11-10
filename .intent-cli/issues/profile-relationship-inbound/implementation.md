# profile-relationship-inbound Implementation Packet

> **親状態の注記**: durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

Profile 用 inbox での Follow/Accept/Reject/Undo(Follow) の受信処理と followers/following の読取を実装する。署名 actor・対象 Profile・元 Follow ID を照合し、古い Accept・別 Profile への操作・重複受信・順序逆転を無害化する。Accept の job 予約と関係変更は P2 の enqueue interface で同一 transaction にする。本番 root router への mount は行わない (P4 が所有)。

## Why

P4 (in-place cutover) が mount するだけで切り替えられるよう、受信側を本番未接続のままテスト構成で完成させるため。P3o とは P2 の enqueue interface を共有して並行でき、D8G (domain 方針の適用) が受信判定を載せる土台になる。

## Scope

- Profile 用 inbox handler: Follow・Accept・Reject・Undo(Follow) の受信と検証 (署名 actor、activity.actor、対象 Profile、元 Follow activity ID の照合)
- 古い Accept・別 Profile への操作・別 actor による Undo・重複受信・順序逆転の無害化
- Accept 予約 (P2 の enqueue interface) と関係変更の同一 transaction
- followers/following の読取 use case と応答変換 (E8 確定契約: ProfileFollowerListResponse・ProfileActorRef local|remote・ProfileFollowResponse に整合)
- 受信 Activity 対応表 (対応・非対応) の作成と PF への記録
- テスト用に直接組み立てた構成 (本番 router へ接続しない) と署名付き HTTP fixture

## Out of scope

- outbound の Follow/unfollow・配送・署名 (P3o)
- domain 単位の方針・Follow への domain 方針適用 (D8P/D8G/D8R)
- 投稿 Activity (Create/Like/EmojiReact/Announce 等) の認可・実受理 (ShuttlePub の後続責務)
- Block/Undo(Block) を含む上記以外の Activity の新規対応 (対応表に未対応として記録するのみ)
- 保存型・migration の新設・本番 migration 採番 (P2/P4)
- 本番 root router への mount・旧 /ap/accounts/... inbox の撤去 (P4)

## Technical baseline

- E8 確定契約 (Emumet#66 / PR #70、2026-11-10 マージ済み・squash 0bfa437): /api/v1/profiles/{profile_nanoid} 系に follows (POST、DELETE /{follow_id})、following/followers (GET)、blocks/mutes (GET/POST、DELETE /{id})、domain-controls (GET 一覧、GET/PUT/DELETE /{domain}) を OpenAPI タグ ProfilePolicy の 501 スタブ (本番 root router 未 mount) として定義済み。全て現在の所有者のみ、エラーは 401/403/404/409/422/501。followers の応答型は following と分離され、ProfileFollowerResponse.follower は ProfileActorRef (kind: local|remote、actor_url: canonical actor URL で常に必須、profile_id: local のみ)、following は ProfileFollowResponse.target (canonical actor URL)。将来 actor は GET /ap/profiles/{profile_nanoid} (URL 最終形は P1 で確定)。POST /api/v1/accounts の profile_username と POST /api/v1/profiles の username は optional で、形式・予約語違反は 400、有効値は P1 実装まで副作用前に 501、ProfileResponse.username は nullable。schema は server/src/schema/profile_policy.rs と profile_username.rs
- P1〜P3 の新機構は本番 root router に mount せず、新配送 worker も root で起動しない。P4 (profile-federation-in-place-cutover) が一括で mount・旧 route 撤去・worker 起動・本番 migration 採番を所有する
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- username 仕様 (E8 で確定): 形式 ^[a-z0-9][a-z0-9._-]{0,63}$ (ASCII 小文字 1〜64 文字)、暗黙の trim・小文字化なし。予約語 admin, administrator, root, system, support, security, moderator, api, ap, auth, oauth, oauth2, login, logout, register, settings, well-known。DB 一意・削除済み再利用なし・Account 名から自動導出しない。段階: E8/P1〜P3 optional → FN で UI 必須送信 → P4 で required
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、AP Block は送らない、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持
- P1 profile-actor-identity-foundation (Emumet#71) が Profile username・actor URI・Profile 鍵 (型と repository)・actor 文書生成を提供する。確定した actor URL 最終形・鍵 repository は P1 closeout で PF に記録される。P1 未マージの間は Emumet#71 の契約に合わせ、曖昧なら issue で質問する
- P2 profile-social-graph-storage (Emumet#72) が固定する保存型・repository port・共通 enqueue interface (P3o/P3i 共通) を使う。P2 の確定形は P2 closeout で host の PF (intents/emumet/features/profile-federation/) に記録される。P2 未マージの間は Emumet#72 の契約に合わせ、型・port が曖昧・不足なら実装を進めず issue で質問する (P2 の型を勝手に拡張・変更しない)
- 受信 Activity 対応表 (本 unit の範囲): Profile 用 inbox が扱うのは Follow・Accept・Reject・Undo (Follow を対象) のみ。Create/Like/EmojiReact/Announce 等の投稿 Activity の認可・実受理は ShuttlePub の後続責務で、Emumet に重複実装しない。Block/Undo(Block) を含む上記以外の Activity の扱いは対応表に「未対応・無害に拒否または無視」として記録し、本 unit で勝手に拡張しない。対応表と非対応の投稿操作は PF に記録する
- 検証の順序: HTTP Signature 検証で得た署名 actor と activity.actor の一致、宛先 inbox の Profile (対象 Profile) と activity の object/target の一致、Accept/Reject/Undo の場合は元 Follow activity ID (P2 が保存する Follow の世代識別子) と保存済み Follow の突合を行う。いずれかが不一致の操作は関係状態を変更しない
- 無害化: 古い (別世代の元 Follow ID を指す) Accept/Reject、別 Profile 宛て・別 Profile の Follow を対象にした操作、重複受信 (P2 の重複受信記録で検知)、順序逆転 (Accept が Follow 登録より先に届く等、Undo が Follow より先に届く等) は、エラーで停止せず・関係を誤って作成/復活させず・既存の正しい関係を壊さずに処理される
- Accept 受信時の関係変更と (必要な場合の) 配送 job 予約は P2 の enqueue interface を使って同一 DB transaction で行う。予約失敗時は関係変更も残らない。Follow 受信時に自動 Accept を返す場合も Follow 受理の関係変更と Accept 予約を同一 transaction にする
- followers/following の読取は E8 確定契約に整合する: followers は ProfileFollowerListResponse (follower は ProfileActorRef: kind local|remote、actor_url 必須、profile_id は local のみ)、following は ProfileFollowResponse (target は canonical actor URL)。認可は Profile の現在の所有者のみ (401/403/404)。保存は P2 の repository から読む。本番 route へは mount しない (読取 use case とテスト構成の route で検証)
- Profile 用 inbox の本番 URL・本番 route は P4 が mount する。本 unit は P1 が確定する Profile actor URL・Profile 鍵 (署名検証は相手の公開鍵、返信 Accept の署名は P3o の配送) に整合させる。Accept の実際の署名配送は P3o の worker が担い、本 unit は job を予約するだけ
- 現状: inbound は Account 単位の inbox (server/src/route/activitypub/ と application/src/service/activitypub/) で処理される。Profile 用 inbox・Profile 単位の受信 use case は存在しない。既存 Account 版は P4 まで変更しない
- 本番 migration は追加しない。本番 root router への mount・worker 起動は行わず、直接組み立てたテスト構成でのみ検証する (実 root 構成で route 不在をテストで確認)

## Acceptance

1. Profile 用 inbox が Follow・Accept・Reject・Undo(Follow) を受信し、署名 actor・activity.actor・対象 Profile・元 Follow activity ID を照合する。署名検証に失敗した request、actor 不一致、存在しない／対象外の Profile 宛ての request は関係状態を変更せず拒否される
2. 古い Accept/Reject (別世代の元 Follow ID)、別 Profile への操作、別 actor による他人の Follow の Undo、重複受信が無害化される (関係が誤って作成・復活・削除されず、重複は P2 の記録で検知される)。順序逆転 (Accept/Undo が Follow より先に届く) でも不整合な関係が残らない
3. Accept (および Follow 受理時の Accept 予約) と関係変更が同一 DB transaction で行われる。予約に失敗したら関係変更も残らず、関係変更に失敗したら job が残らない
4. followers/following の読取が E8 確定契約 (ProfileFollowerListResponse・ProfileActorRef の local|remote、following の target) に整合し、local/remote 双方の fixture で検証される。読取は現在の所有者のみで、別 Profile・他 Account の関係を返さない
5. 受信 Activity 対応表 (対応: Follow/Accept/Reject/Undo(Follow)、非対応: 投稿 Activity とそれ以外) が PF に記録され、非対応 Activity が関係状態を変更しないことをテストで確認する
6. 本番 root router に Profile 用 inbox を mount せず、worker を起動しない。実 root 構成で対象 route が存在しないことをテストで確認する
7. openapi.json に変更が出る場合は最新 main から再生成し openapi_spec_matches_committed_file が通る。既存 Rust CI が通る

## Verification

実 DB (DATABASE_URL 必須、skip のみ不可) と署名付き HTTP fixture (有効署名・無効署名・actor 不一致) による受信テスト、重複受信・順序逆転・古い Accept・別 Profile 宛て・不正参照 (存在しない元 Follow ID・他人の Follow への Undo) のテスト、Accept 予約と関係変更の同一 transaction (予約失敗時のロールバック) テスト、followers/following の local/remote fixture テスト、実 root 構成の route 不在テスト、cargo fmt / clippy / test。

## Dependencies / Merge order

P1 (Emumet#71) と P2 (Emumet#72) のマージ後に実装をマージする (両方に依存)。P3o (profile-relationship-outbound) とは P2 が固定する enqueue interface を共有し並行可能。E8 (Emumet#66 / PR #70) はマージ済み。共有ファイルの統合は一件ずつ、その時点の main から OpenAPI を再生成する。

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/profile-federation/overview.md (primary)。supporting: intents/emumet/features/personal-domain-controls/overview.md、intents/emumet/features/ap-federation/overview.md、intents/emumet/features/block-mute/overview.md、intents/shuttlepub/packets/candidates.md、intents/shuttlepub/product/social-experience.md ほか`
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: 受信 Activity 対応表 (対応 Activity・非対応の投稿操作)、受信検証 (署名 actor・対象 Profile・元 Follow ID) と無害化規則、followers/following 読取の確定形を PF acceptance.md に記録する
- Closeout writeback expected: yes — 受信 Activity 対応表の確定形、無害化規則 (古い Accept・順序逆転・重複受信)、followers/following 読取の応答形、Block/Undo(Block) 等の未対応 Activity の扱い (host の `intents/emumet/features/profile-federation/packets.md`、`intents/emumet/features/profile-federation/acceptance.md` へ。host 更新は親が行う)
