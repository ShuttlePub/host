# profile-domain-follow-guards Implementation Packet

> **親状態の注記**: durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

Profile が設定した domain block を新規 Follow の制御に実適用する。inbound/outbound の新規 Follow を拒否し、block 中の相手からの古い Accept を関係に反映せず、未送信の Follow/Accept を配送前に判定して取り消す。block 更新と Follow 更新は共通ロック規約で直列化し、local/local は両 Profile を一定順序でロックする。mute は Follow を拒否しない。既存関係の一括解除と投稿操作の拒否は含まない。

## Why

D8P が domain 方針の保存と照合関数を用意し、P3o/P3i が Profile 単位の送受信を用意した。本 unit はその間をつなぎ、block 後に新規 Follow が成立しないことを競合・遅延・再送に対しても保証する。D8R (block 設定時の関係解除) が同じロック規約と判定を使えるよう、規約を先に固定する。

## Scope

- inbound の新規 Follow 拒否と outbound の新規 Follow 拒否 (block のみ。mute は対象外)
- block 対象の相手からの古い Accept の反映防止
- 未送信の Follow/Accept の配送前判定と取消
- block 更新と Follow 更新の共通ロック規約 (local/local は一定順序で両 Profile ロック) と文書化
- Undo/Reject 等の後始末を block 中も許可する経路の確認
- テスト用に直接組み立てた構成 (本番 router・root main.rs へ接続しない) での実 DB 競合テスト

## Out of scope

- 既存 Follow/Follower 関係の一括解除、解除に伴う Undo/Reject の送信、block 設定の原子的実行、domain-controls の block 書込有効化 (D8R)
- 投稿 (返信・引用・リポスト・いいね/絵文字) の受理・送信拒否・表示抑制 (ShuttlePub の後続 unit。Emumet に重複実装しない)
- AP Block の送信、復元用関係一覧
- 本番 root router への mount・worker 起動・旧 route 撤去 (P4)、UI (F8)

## Technical baseline

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
- 確定済みの先行 unit: E8 (Emumet#66 / PR #70、squash 0bfa437)。P2 (Emumet#72 / PR #77、squash f523b86): 保存モデル・共通 enqueue interface・配送 worker 向け port・初期化対象/非対象一覧は host の PF acceptance.md『P2 確定契約』が正本。D8P (Emumet#73 / PR #76、squash b3e87f2): domain 正規化・tombstone revision・所有者認可・照合関数 FindDomainControlForActorUseCase (検証済み canonical actor ID の host と完全一致) は host の DC acceptance.md『D8P 確定契約』が正本で、domain-controls route は本番未 mount。P1 (Emumet#71 / PR #78) はレビュー修正中で、actor URL は {PUBLIC_BASE_URL}/ap/profiles/{nanoid}、Profile 鍵は新テーブル profile_signing_keys、本番 router 構築を server/src/root_router.rs に切り出す (確定形は P1 closeout で PF に記録される。P1 マージ前は PR #78 と Emumet#71 の契約に合わせ、曖昧なら issue で質問する)。P3o (Emumet#74)・P3i (Emumet#75)・FN (shuttlepub-frontends#34) は実装中または未マージ
- migration の分担 (親判断、2026-11-10): P1・D8P の非破壊の追加 migration (列・テーブル・index) は通常の migrations/ に置き本番適用してよい (D8P の 20260920000001_profile_domain_controls.sql は既に本番 migrations/ にある)。P4 (profile-federation-in-place-cutover) が所有するのは、旧連合データ初期化などの破壊的 migration と、P2 の新関係・配送テーブルの本番採番・配置 (driver/fixtures/profile_social_graph/ の 01 schema・02 reset)
- 照合は D8P の FindDomainControlForActorUseCase (kernel: ControlDomain::from_actor_id / DomainControl::applies_to_actor_id) を使う。照合主体は検証済み canonical actor ID の host のみで、inbox / sharedInbox / CDN / メディア URL の host は使わない。完全一致のみで sub.example.com へ拡張しない。mode は mute / block。mute は Follow を拒否しない (表示抑制のみで、Follow には適用しない)。D8P の判定関数は認可なしの内部判定用で、port は無視する
- Emumet が実適用するのは新規 Follow の制御のみ。投稿 (返信・引用・リポスト・いいね/絵文字) の受理・送信拒否は ShuttlePub の後続責務 (将来の personal-domain-content-enforcement 相当 unit、未実装) で、Emumet inbox に投稿内容の最終認可を重複実装しない
- Follow の世代 (P2 確定契約): ProfileFollowRepository::begin_generation は Created / ReplayedActivity (同じ follower と元 activity ID の世代が既にあれば終了済みでも返し、古い activity の再送で世代は復活しない) / ActiveGenerationExists を返す。accept (pending→accepted)・end (有効→ended) は compare-and-swap。配送 job は ProfileDeliveryJobRepository の cancel / cancel_undelivered_for_follow と、claim_due / record_attempt の lease で扱う。これらを変更せず使う
- D8P の domain-controls 書込は 1 transaction で Profile 行を FOR SHARE ロックして所有者を確認する。block と Follow 更新を直列化する共通ロック規約 (どの行をどの順でロックするか) を本 unit が定めて文書化し、D8R が block 設定時に同じ規約を使えるようにする
- local/local の Follow (同一 host の 2 Profile) は、両 Profile を一定の順序 (例: ProfileId 昇順) でロックしてデッドロックを避ける。block されている側・している側のどちらの方針も判定する
- Undo / Reject などの後始末 (関係を終わらせる側の activity) は block 中も許可する。拒否するのは新規 Follow の確立と、block 対象の相手からの古い Accept による関係の accepted 化・復活だけ
- block 中に新規 Follow を拒否する際の応答の形 (Reject を返すか、何も返さず無視するか) は P3i/P3o と D08 決定 (AP Block は送らず、フォロー解除に必要な最小限の通知のみ) に整合させる。P3i/P3o の確定形に合わせ、曖昧なら実装で独断せず issue で質問する
- P4 前でも隔離 fixture/テスト用に直接組み立てた router で検証できる。本番 root router への mount・worker 起動は P4 が所有し、domain-controls の block 書込有効化は D8R
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, root_router.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、AP Block は送らない (フォロー解除に必要な最小限の通知のみ)、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持

## Acceptance

1. 対象 domain を block した Profile P へ、その domain の actor (検証済み canonical actor ID の host が完全一致) からの新規 Follow を inbound で拒否する。P から対象 domain への新規 Follow (outbound) も拒否する。拒否時は関係・Follow 世代・配送 job を作らない
2. block 中に届いた、block 対象の相手からの古い Accept で関係が accepted にならない (pending/終了のまま)。block を解除した後に古い activity を再送しても、終了済みの世代は復活しない
3. 未送信の Follow と Accept (配送 job が pending/retrying) は、配送前に block を判定し、block 中なら送信せず取り消す (cancel)。送信済みの activity は取り戻せないことを前提に、その後の関係状態が block と矛盾しない
4. mute は Follow を拒否しない (mute 設定下でも inbound/outbound の Follow・Accept が通常どおり成立する)。完全一致のみで、sub.example.com に example.com の設定は適用されない。inbox/CDN の host では判定しない
5. block 方針の更新と Follow 更新 (受信・送信・Accept 反映・配送) が共通ロック規約で直列化され、競合しても block 後に新規 Follow が成立しない／block 前に確立した判定結果が不整合にならない。規約が文書化されている
6. local/local の Follow は両 Profile を一定順序でロックし、相互 (A→B と B→A) の同時操作でデッドロックしない
7. Undo・Reject など関係を終わらせる後始末の activity は block 中も処理される
8. Profile ごとの方針が分離される (Profile P の block は同一 Account 内の別 Profile Q・他 Account の Profile の Follow に影響しない)。Profile 移管後も方針は Profile に付いたまま適用される
9. 既存の関係の一括解除 (D8R) と投稿操作の拒否 (ShuttlePub) を実装していない。Follow だけが実適用対象であることがコードとテストから明らか
10. 本番 root router に mount せず、root の main.rs から worker を起動しない (実 root 構成での不在テスト)。openapi.json に変更が出る場合は最新 main から再生成し openapi_spec_matches_committed_file が通る。既存 Rust CI が通る

## Verification

実 DB (DATABASE_URL 必須、skip のみ不可) での、受信・送信・配送・block 更新の競合 (同時実行)、重複受信、遅延 Accept、block 解除後の古い activity 再送、local/local の相互同時操作 (デッドロックなし)、mute 不適用、完全一致、Profile 分離・移管。署名付き fixture による inbound 検証。実 root 構成の不在テスト。cargo fmt / clippy / test。

## Dependencies / Merge order

P3o (Emumet#74)・P3i (Emumet#75) のマージ後にマージする (D8P・P2 はマージ済み。P1 は P3o/P3i 経由)。P4 前でも隔離構成で検証できる。後続の D8R は本 unit と P4 のマージ後。共有ファイルの統合は一件ずつ、その時点の main から OpenAPI を再生成する。

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/personal-domain-controls/overview.md (primary)。supporting: intents/emumet/features/profile-federation/overview.md、intents/emumet/features/ap-federation/overview.md、intents/emumet/features/block-mute/overview.md、intents/shuttlepub/packets/candidates.md ほか`
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: 共通ロック規約・拒否応答の形・Follow だけが実適用対象であることを DC acceptance.md に記録する
- Closeout writeback expected: yes — 共通ロック規約の確定形 (ロック対象・順序)、block 中の拒否応答の形、古い Accept の扱い、配送前判定の位置、D8R への申し送り (host の `intents/emumet/features/personal-domain-controls/packets.md`、`intents/emumet/features/personal-domain-controls/acceptance.md` へ。host 更新は親が行う)
