## 親状態の注記

durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。

## Goal

Profile が domain を block したとき、対象 domain の actor との既存の following/follower 関係 (pending を含む) を両方向に解除し、不要な配送 job を取り消し、必要最小限の後始末通知 (自分の Follow には元 Follow を参照する Undo、相手の Follow には Reject 等) を予約する処理を、block の保存と同一 transaction で原子的に行う。外部障害でもローカル適用は成功し、AP Block は送らない。P4 のマージ後に domain-controls route の block 書込を本番で有効化して公開 API に接続する。

## Why This Slice Exists Now

D8G は新規 Follow の拒否までで、block 設定時に既に存在する関係の解除は D8R の責務。P4 が本番 root router を一括で切り替えた後でなければ公開 API に接続できないため、P4 に依存する。

## Current Observed State

- D8P は domain-controls の保存・認可・revision を実装済みだが route は本番未 mount、block は関係解除を伴わない (本 unit が実装する)
- D8G (Follow の拒否・ロック規約) と P4 (root router 切替) は未着手/未マージ
- P2 に end_active_between・cancel・enqueue interface があり、P3o に Undo/Reject 等の送信基盤が入る

## Accepted Baseline You May Assume

- durable state、packet、intent、queue の正本は ShuttlePub/host のみ。Emumet 側の旧 design-host 記述を根拠に child へ親状態を作成しない。
- 確定済みの先行 unit: E8 (Emumet#66 / PR #70、squash 0bfa437)。P2 (Emumet#72 / PR #77、squash f523b86): 保存モデル・共通 enqueue interface・配送 worker 向け port・初期化対象/非対象一覧は host の PF acceptance.md『P2 確定契約』が正本。D8P (Emumet#73 / PR #76、squash b3e87f2): domain 正規化・tombstone revision・所有者認可・照合関数 FindDomainControlForActorUseCase (検証済み canonical actor ID の host と完全一致) は host の DC acceptance.md『D8P 確定契約』が正本で、domain-controls route は本番未 mount。P1 (Emumet#71 / PR #78) はレビュー修正中で、actor URL は {PUBLIC_BASE_URL}/ap/profiles/{nanoid}、Profile 鍵は新テーブル profile_signing_keys、本番 router 構築を server/src/root_router.rs に切り出す (確定形は P1 closeout で PF に記録される。P1 マージ前は PR #78 と Emumet#71 の契約に合わせ、曖昧なら issue で質問する)。P3o (Emumet#74)・P3i (Emumet#75)・FN (shuttlepub-frontends#34) は実装中または未マージ
- migration の分担 (親判断、2026-11-10): P1・D8P の非破壊の追加 migration (列・テーブル・index) は通常の migrations/ に置き本番適用してよい (D8P の 20260920000001_profile_domain_controls.sql は既に本番 migrations/ にある)。P4 (profile-federation-in-place-cutover) が所有するのは、旧連合データ初期化などの破壊的 migration と、P2 の新関係・配送テーブルの本番採番・配置 (driver/fixtures/profile_social_graph/ の 01 schema・02 reset)
- block の意味 (D08 決定 q01/q10/q12): 表示抑制に加え、対象 domain の利用者との既存 Follow/Follower 関係を自分側の記録から両方向に解除する。解除しても関係は復元しない (復元用関係一覧も保持しない。再び繋がるには利用者が再フォローする)。domain block は相手サーバーへ AP Block を送らず、フォロー解除に必要な最小限の通知 (Undo/Reject) だけを送る。個別 actor の block (P3o の block_actor) は、これに加えて AP Block (object=相手 actor) を配送し、解除は Undo(Block) を送る (ユーザー決定による範囲追加。revision_history 参照)
- 関係の解除は P2 確定契約の end_active_between (両方向の有効な世代を終了、受理済みかは accepted_at で判別、終了理由 blocked) と、配送 job の cancel_undelivered_for_follow / cancel、共通 enqueue interface (ProfileDeliveryEnqueuer、関係変更と同一 transaction) を使う。block 本体の適用 (拒否判定・解除・job 予約) は use case の責務 (P2 の申し送り)
- 解除時に送る activity は関係の作者に従う: 自分 (block した Profile) が送った Follow には、元 Follow activity ID を参照する Undo(Follow)。相手が送った Follow (相手作成) には、正当な Reject (元 Follow を参照) 等を使い、相手作成の Follow を自分が作者であるかのように Undo しない。pending 関係 (未 Accept) も解除する。受理済み関係は Follow/Follower 両方向を解除する
- 未送信 job は取消 (cancel)。送信済み・結果不明 (in_flight で lease 切れ等) の場合は、相手側の状態を整えるために必要な後始末 (Undo/Reject) を予約する。配送中に競合した job の後始末も扱う
- ローカル適用は外部障害と独立: 相手サーバーの障害・配送失敗でも block と関係解除のローカル適用は成功し、巻き戻らない (関係状態と配送状態の分離、P3o の原則)。block 設定と関係解除・job 取消・最小通知予約は同一 transaction で原子的に行い、途中失敗は全体 rollback
- 共通ロック規約は D8G が定めたものを使う (block 更新と Follow 更新の直列化、local/local は両 Profile を一定順序でロック)。D8P の revision 規則 (PUT の expected_revision、tombstone) と所有者認可・移管との直列化 (Profile 行 FOR SHARE) を壊さない
- domain-controls route (GET 一覧・GET/PUT/DELETE /{domain}) の本番 mount: P4 が root router を一括所有し、block 書込は D8R が有効化するまで本番で受け付けない。したがって本 unit は P4 のマージ後に、domain-controls の block 書込を有効化する (mute のみ先行公開するか全体を本 unit で mount するかは未決。P4 の既定は全体未 mount のまま維持で、本 unit が mount する。変更したい場合は issue で質問)。OpenAPI の CONTRACT ONLY / not mounted 注記は実際の mount 状態に合わせて更新する
- D08 のうち Emumet が実適用するのは Follow 制御 (D8G の新規 Follow 拒否と本 unit の既存関係解除) のみ。投稿 (返信・引用・リポスト・いいね/絵文字) の受理・送信拒否・表示抑制・既存反応件数の扱いは ShuttlePub の後続責務で、本 unit では実装しない。完了時に「D08 本番適用完了」と書かない
- 自 host の domain を block 対象にした場合 (local/local 関係の扱い) の挙動が曖昧なら、実装で独断せず issue で質問する
- 共有ファイル (server/src/openapi.rs, route.rs, main.rs, root_router.rs, DI wiring, migrations/, openapi.json) は他レーンと競合する。共有ファイルの統合は一件ずつ行い、その時点の main から OpenAPI を再生成する (openapi_spec_matches_committed_file を通す)
- 検証は DATABASE_URL を設定した実 DB テストで行う。DB テストを skip のみで通過させない (test_with::env による skip は検証として数えない)
- D08 ユーザー決定 (grill d08-q01〜q15): Profile 単位、完全一致 domain のみ、mute は表示抑制のみ、block は双方向 Follow 解除＋新規操作拒否 (解除しても関係復元なし)、domain block は AP Block を送らない (フォロー解除に必要な最小限の通知のみ。個別 actor block は AP Block を送る=範囲追加)、旧連合 identity は引き継がず新 Profile actor から開始 (旧連合データのみ初期化、DB 全消去ではない)、username は Profile ごとに一意・一度決めたら不変・移管後も維持

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`
Path: application/src/ (block 設定 use case: domain-control の block 書込・両方向の関係解除・不要 job 取消・最小通知予約を原子的に実行), driver/src/ (必要な DB 実装), kernel/src/ (必要な port の追加のみ), server/src/ (domain-controls route の本番 root router への接続と block 書込の有効化。P4 が root router を一括所有するため P4 マージ後に行う), openapi.json (not mounted 注記の更新), 関連テスト (実 DB・署名付き mock peer)
Part: domain block の設定を、既存の following/follower 両方向の関係解除・未送信 job 取消・送信済み分の最小限の後始末通知予約と同一 transaction で行い、公開 API (domain-controls) に接続する

## In Scope

- block 設定の原子的実行 (block 保存・両方向の関係解除・不要 job 取消・最小通知予約を同一 transaction で)
- 自分の Follow への Undo(Follow)・相手の Follow への Reject 等、関係の作者に応じた後始末 activity の予約
- 送信済み・結果不明・配送中競合 job の後始末
- block 解除後の非復元 (復元用一覧を持たない)
- domain-controls route の本番 root router への接続と block 書込の有効化 (P4 マージ後)、OpenAPI 注記の更新

## Out Of Scope

- 復元用関係一覧・解除時の関係復元、domain block の AP Block 送信 (個別 actor block の AP Block / Undo(Block) は範囲追加で含む)
- 投稿 (返信・引用・リポスト・いいね/絵文字) の受理・送信拒否・表示抑制の実制御 (ShuttlePub の後続 unit)。既存反応件数の扱い・通知/検索 filter も含まない
- 新規 Follow の拒否 (D8G)、root router 切替・旧 route 撤去 (P4)、UI (F8)

## Standalone Child Issue Contract

Profile が domain を block したとき、対象 domain の actor との既存の following/follower 関係 (pending を含む) を両方向に解除し、不要な配送 job を取り消し、必要最小限の後始末通知 (自分の Follow には元 Follow を参照する Undo、相手の Follow には Reject 等) を予約する処理を、block の保存と同一 transaction で原子的に行う。外部障害でもローカル適用は成功し、AP Block は送らない。P4 のマージ後に domain-controls route の block 書込を本番で有効化して公開 API に接続する。 本 PR は、domain block の設定を既存関係の両方向解除・job 取消・最小通知予約と原子的に実行し、domain-controls を本番 API に接続する。受け入れ条件の 10 項目を満たし、AP Block・復元・投稿操作の実制御を含まない。P4 のマージ後に block 書込を有効化する。

## Acceptance Criteria

1. Profile P が domain を block すると、同一 transaction で、block の保存、対象 domain の actor との pending を含む Follow/Follower 両方向の関係の終了、不要な配送 job の取消、最小限の後始末通知の予約が行われる。途中で失敗したら全て rollback され、一部だけ残らない
2. pending (未 Accept) の関係も解除される。受理済みは Follow・Follower 両方向が解除される。対象は完全一致の domain の actor のみで、sub.example.com に example.com の block は影響しない
3. 自分が送った Follow の解除には、元 Follow activity ID を参照する Undo(Follow) が送られる。相手が送った Follow の解除には正当な Reject (元 Follow を参照) 等が送られ、相手作成の Follow を自分が作者であるかのように Undo しない (wire-level の activity 検査で確認)
4. 未送信の job は取り消される。送信済み・結果不明の job は必要な後始末が予約される。配送中に block が競合しても後始末が漏れず、二重送信が無害
5. 外部障害 (相手の 5xx・timeout・不達) でも block と関係解除のローカル適用は成功し巻き戻らない。domain block では AP Block activity は送られない (署名付き mock peer の受信内容で確認)。個別 actor block では Block (object=相手 actor) が署名付きで配送され、解除で元 Block を埋め込んだ Undo(Block) が届く (Block が未送信なら Block job を取消して Undo なし、120 秒・lease 規則は Follow の Undo と同じ。ローカル相手は配送しない。Undo/Reject との併用。範囲追加)
6. block を解除 (DELETE 等) しても関係は復元されず、復元用関係一覧も保持されない。解除後に古い activity を再送しても関係が復活しない。再フォローは利用者の新しい操作
7. domain-controls route が本番 root router に接続され (P4 マージ後)、現在の所有者のみが block を書き込める。revision 競合 (409)・不在 (404)・不正 domain (422)・認可 (401/403) が D8P 契約どおり。mute の挙動 (関係を切らず Follow を拒否しない) は変わらない
8. block・解除は Profile ごとに分離され、同一 Account 内の別 Profile・他 Account の Profile の関係に影響しない。Profile 移管後も方針が Profile に付いたまま働く
9. Emumet の Follow 制御のみを実適用しており、投稿操作の実制御・domain block の AP Block・復元機能を含まない (個別 actor block の AP Block は範囲に含む)。openapi.json の注記が実際の mount 状態と一致する
10. 個別 actor の block (block_actor) は、domain block とは別に、remote actor へ AP Block (object=相手 actor、ID は block ID から決定的) を関係解除の Undo(Follow)/Reject(Follow) と併用して同一 transaction で予約・配送し、解除は元 Block を埋め込んだ Undo(Block) を送る。Block 未送信のうちの unblock は Block job を取消して Undo を送らない。Local→Local は配送しない。受信した Block / Undo(Block) は関係を変えない (P3i のまま)。配送 job 種別の DB CHECK への Block 追加は D8R の新しい migration で行い、P4 のコードは変更しない
11. openapi.json は最新 main から再生成し openapi_spec_matches_committed_file が通る。既存 Rust CI (E2E を含む) が通る

## Verification

実 DB (DATABASE_URL 必須、skip のみ不可) と署名付き mock peer による、両方向解除 (pending・受理済み)・wire-level activity 検査 (Undo の object が元 Follow、Reject の object、AP Block が出ないこと)・外部障害でのローカル適用成功・配送中競合・transaction rollback・解除後の非復元・古い activity 再送。domain-controls の認可・revision・完全一致・Profile 分離・移管。本番共有 router (root_router.rs) 上の mount 検査。openapi 再生成。cargo fmt / clippy / test、E2E。

## Revision History

- 2026-11-11: 範囲追加 (ユーザー決定 question-e6dfa2b98a9dc74491b19bbcf2ba5ca4『個別 actor ブロックは AP Block を送る (Follow 解除の Undo/Reject と併用、ブロック解除時は Undo(Block))。ドメインブロックは送らない』)。P3o の『AP Block 送信は保留中』を確定に更新し、個別 actor block の AP Block / Undo(Block) の配送を D8R に含めた (Emumet PR #93)。domain block は引き続き AP Block を送らない。
- 2026-11-11: Emumet#84 の issue 本文を github-body.md の内容で gh issue edit により同期 (ユーザー許可 question-a400e8a5dd88cfb79865cbb5282d7dbe)。title・ラベルは変更なし

## Related Links

- host: intents/emumet/features/personal-domain-controls/ (primary)、intents/emumet/features/profile-federation/、intents/shuttlepub/packets/candidates.md (D08)
- E8: Emumet#66、D8P: Emumet#73 / PR #76、P2: Emumet#72 / PR #77、P3o: Emumet#74、P3i: Emumet#75。D8G・P4 の issue 番号は host の queue-state を参照

## Dependencies

profile-domain-follow-guards、profile-federation-in-place-cutover

## Merge Order

D8G (profile-domain-follow-guards) と P4 (profile-federation-in-place-cutover) のマージ後にマージする。P4 マージ後に domain-controls の block 書込を有効化する。P4 のマージ・本番切替前にはユーザー確認が必要 (P4 の issue 参照)。共有ファイルの統合は一件ずつ、その時点の main から OpenAPI を再生成する。

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/personal-domain-controls/overview.md (primary)。supporting: intents/emumet/features/profile-federation/overview.md、intents/emumet/features/ap-federation/overview.md、intents/emumet/features/block-mute/overview.md、intents/shuttlepub/packets/candidates.md ほか`
- ADR candidate: なし
- Diagram candidate: なし
- Docs update: block 設定の原子的実行・後始末 activity・D08 の Emumet 部分だけ実適用済みであることを DC acceptance.md に記録する
- Closeout writeback expected: yes — block の原子的実行の確定形、後始末 activity の対応表 (自分/相手作成の Follow)、結果不明 job の扱い、domain-controls mount の確定形、残る D08 実装 (ShuttlePub 側投稿制御) の明記 (host の `intents/emumet/features/personal-domain-controls/packets.md`、`intents/emumet/features/personal-domain-controls/acceptance.md`、`intents/shuttlepub/packets/candidates.md` へ。host 更新は親が行う)

## Guide Reachability (G645)

implementation-loop ガイド (host) → implementation ロール → domain-controls の公開 API (本番 root router、P4 マージ後) と block 設定の内部 use case (ShuttlePub/Emumet)。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
