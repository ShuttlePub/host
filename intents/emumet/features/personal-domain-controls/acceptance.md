# personal-domain-controls — acceptance

> 契約・検証境界。overview は [overview.md](overview.md)。個別 unit の受け入れ詳細は各 packet が正本。

## D08 全体の受け入れ（全 unit 完了時。現時点では未達）

- [ ] Profile P の mute で表示が抑制され既存関係は残る。block では表示抑制＋既存 Follow／Follower の両方向解除
- [ ] P の設定は同一 Account の別 Profile Q・他 Account の Profile に波及せず、全体 HostModeration も発生させない
- [ ] 設定は実保存され再取得後も適用される（D8P）
- [ ] block 対象 domain から P への新規 Follow、P から対象 domain への新規 Follow を拒否（D8G）。mute は拒否しない
- [ ] block で pending を含む両方向の関係が解除され、**domain block は AP Block を送らず**最小限の通知（Undo/Reject）のみ（個別 actor block は AP Block と Undo(Block) を送る。ユーザー決定 question-e6dfa2b98a9dc74491b19bbcf2ba5ca4）。外部障害でもローカル適用は成功（D8R）
- [ ] 解除後も関係は復元されず、復元用一覧も保持されない。再フォローは利用者操作
- [ ] 完全一致のみ（`sub.example.com` に `example.com` の設定は適用されない）
- [ ] 返信・引用・リポスト・いいね／絵文字の新規受理・送信拒否、表示抑制（ShuttlePub 側・後続 unit）
- [x] UI から実ログイン→実方針保存・取得→Follow 解除まで確認（F8。2026-11-12、第1段 PR #40 で Emumet main 82fa49b に対するローカル実 E2E。シナリオのリポジトリ移設は引継ぎ。下の「F8 確定」）

## E8（契約）の受け入れ境界

- Profile identity・Follow・個別 block/mute・domain-controls の認可・revision・エラーが OpenAPI に定義される。
- 作成 API の username は P4 まで optional。指定時は形式検証し、保存未実装の間は作成副作用前に明示的な未実装エラー（黙って無視しない）。
- 将来用 Profile actor／関係 route は本番未 mount であることを schema 説明にも記載。
- 外部 ID は nanoid。username 更新 API を通常の編集機能として設けない。
- 検証: OpenAPI 再生成、旧作成 payload・新 payload・未実装エラーの contract test、既存 Rust CI。
- 非目標: 新関係処理・方針保存・username 保存の実装。

### E8 確定契約（Emumet PR #70、squash `0bfa437`、2026-11-10 マージ済み）

- 契約 route は本番 root router に未 mount（タグ `ProfilePolicy`）。ハンドラは明示的 501 で、架空の成功・`todo!` はない。OpenAPI の tag・各 operation・**component schema 16 型の説明**に「CONTRACT ONLY / NOT MOUNTED」を記載し、テストで固定。
  - Profile identity `GET /api/v1/profiles/{profile_nanoid}`、Profile actor `GET /ap/profiles/{profile_nanoid}`（**actor URL の最終形・WebFinger は P1 で確定**）
  - Follow: `POST|DELETE .../follows[/{follow_id}]`、`GET .../following`、`GET .../followers`
  - 個別 block/mute: `GET|POST .../blocks`・`DELETE .../blocks/{block_id}`、`GET|POST .../mutes`・`DELETE .../mutes/{mute_id}`
  - domain-controls: `GET .../domain-controls`、`GET|PUT|DELETE .../domain-controls/{domain}`
- **followers の応答型は following と分離**。`ProfileFollowerResponse.follower` は `ProfileActorRef`（`kind`: local|remote、`actor_url`: canonical actor URL で常に必須、`profile_id`: local のみ）。remote／local 双方の応答 fixture あり。following は `ProfileFollowResponse.target`（canonical actor URL）。
- **domain-controls の revision / 409**: revision は 1 始まりで変更ごとに単調増加。PUT は `expected_revision` 省略＝新規作成（既存なら 409）、指定＝現 revision 一致時のみ置換（不一致・同時削除済みは 409）。DELETE は `expected_revision` 必須（不一致 409）。認可は Profile の現在の所有者のみ（401/403/404）。domain は完全一致（正規化の詳細は D8P）。block 書込は D8R まで未 mount。
- **username 段階（E8）**: `POST /api/v1/accounts` の `profile_username`・`POST /api/v1/profiles` の `username` は optional（`null` は省略扱い）。形式・予約語違反は **400**、有効値は保存未実装のため **501**。いずれも `resolve_auth_account_id` を含む作成副作用の前に拒否し、指定値を黙って捨てない。省略した旧 payload は従来どおり 201。`ProfileResponse.username` は nullable（未設定）。username 更新 API は設けない（テストで固定）。
- 検証: OpenAPI 再生成、実 DB（PostgreSQL 16）で workspace テスト（旧 payload・新 payload・501/400・副作用なし）、CI 全 green。
- **後続への引き継ぎ**: 未 mount の不在テストは `main.rs` の文字列検査＋テスト router のみ。**本番と共有する router 構成関数による「対象 route 不在」検査を P1（実 root 構成の route 不在テスト）／P4（mount 時）で実装**。

### D8P 確定契約（Emumet PR #76、squash `b3e87f2`、2026-11-10 マージ済み、queue completed）

- **到達範囲**: domain-controls（GET 一覧・GET/PUT/DELETE `/{domain}`）の実保存・取得・更新・削除と所有者認可・revision 競合制御。**Follow への適用（D8G）・block 設定時の関係解除（D8R）・投稿 filter は未実装**。route は mute/block とも **本番 root router に未 mount**（`DomainControlRouter` はテスト専用。本番形 router で 4 operation が 404 になるテストと `main.rs` の文字列検査で固定）。mute 先行公開は未決のまま。OpenAPI の tag・component schema 16 型の「CONTRACT ONLY / not mounted」注記は維持し、domain-controls の 501 記述だけ除去。
- **domain 正規化規則**（`kernel/src/entity/domain_control.rs` の `ControlDomain::parse`、正規化表・拒否表をテストで固定）:
  1. 空・空白/制御文字・`* : / ? # @ \ [ ] % ^ | < >` を含むものは拒否（scheme・userinfo・port・path・ワイルドカード・IPv6）
  2. 末尾ドットは **1 つだけ**除去（`example.com.` = `example.com`、`example.com..` は不正）
  3. UTS #46 non-transitional で ASCII 化（大文字小文字・Unicode 正規化・全角/`。` 区切り・Punycode。`bücher.example` → `xn--bcher-kva.example`、`faß` は `ss` に畳まない）、既存 `xn--` ラベルの検証、DNS 長（label ≤ 63・全体 ≤ 253・空ラベルなし）
  4. 結果は `[a-z0-9_-]` ラベルを `.` で連結したものに限る（`_` は実在 host のため許容）
  5. 最後のラベルが数字のみ、または `0x…` の 16 進数なら拒否（IPv4 として解釈され得る `127.1`・`2130706433`・`0x7f000001` 等）
  6. 不正 domain は **422**（E8 の「Malformed domain = 400」から変更。400 は PUT の JSON 不正と DELETE の `expected_revision` 欠落/不正に限定）。path の `{domain}` は同規則で正規化され、応答の `domain` は常に正規化形。完全一致のみで `sub.example.com` へ拡張しない
- **照合主体と関数**: **検証済み canonical actor ID の host のみ**（inbox / sharedInbox / CDN / メディア URL は引数にできない形）。kernel: `ControlDomain::from_actor_id(verified_actor_id)`・`DomainControl::applies_to_actor_id(..)`（純関数。port は無視、資格情報付き ID・IP リテラル・http/https 以外は拒否/不一致）。application: `FindDomainControlForActorUseCase::find_domain_control_for_actor(&ProfileId, verified_actor_id) -> Result<Option<DomainControl>>`（認可なしの内部判定用。D8G/D8R/ShuttlePub が利用する）。
- **保存と revision**: テーブル `profile_domain_controls`（PK `(profile_id, domain)`、`profiles` へ ON DELETE CASCADE、mode/revision/domain の CHECK 制約）。revision は 1 始まりで **作成・置換・削除・再作成のたびに +1**。削除は **tombstone**（`deleted_at`）で revision を保持し、再作成は直前 +1 から続く（古い `expected_revision` が別世代に一致しない ABA 防止）。読取り側は `deleted_at IS NULL` を必ず付ける。書込みは単一の原子的 SQL（`INSERT … ON CONFLICT DO UPDATE … WHERE deleted_at IS NOT NULL` / `UPDATE … WHERE revision = $n`）で同時 writer は 1 つだけ成功（実 DB で 12 並行 writer 検証）。PUT は同一 mode でも revision を増やす。DELETE は不一致 409・不在 404（同時削除の敗者は 404）。PUT で `expected_revision` 指定かつ不在/削除済みは 409。
- **認可と移管との直列化**: 所有者は Profile の**現在の** `account_id`（組織コンテキスト `X-Organization-Id` ならその組織が所有者でアクティブメンバー、無指定なら呼び出し者の個人 Account が所有者）。所有者確認・読取り・書込みは **1 transaction** で、先頭の `SELECT id, account_id FROM profiles WHERE nanoid = $1 FOR SHARE` で Profile 行を共有ロックして現所有者を読む。Profile 移管の `UPDATE profiles` はこのロックと競合し、操作完了まで待機するか先にコミットされて旧所有者が 403 になる（決定的な実 DB テスト 2 件。`FOR SHARE` を外すと失敗することを確認）。移管後は新所有者のみ操作可、方針は Profile に付いたまま維持。401/403/404（Profile・control 不在）/409/422。所有者判定は Keto ではなく DB。
- **migration の扱い（要注意）**: `migrations/20260920000001_profile_domain_controls.sql` は **本番 `migrations/` に入ってマージ済み**（起動時に自動適用される。route 未 mount のため未使用）。P2 の schema は `driver/fixtures/` で本番 `migrations/` 未配置のため扱いが異なる点に注意。**P4 の旧連合データ初期化の対象外テーブル**（旧連合データではなく Profile に付く利用者設定。DB 全消去の対象にしない）。P4 は番号の再採番を要しない（既にマージ済み）が、P1 の migration 番号との整合は P1 側で確認する。
- 検証: 専用の使い捨て PostgreSQL 16 で workspace テスト全 pass（マージ後 head: application 178 / driver 244 / kernel 198 / server 114）、fmt・clippy -D warnings、CI 全 green。
- **後続への引き継ぎ**: 本番共有 router 構成による「対象 route 不在」検査への置換（現状は `build_test_router` と `main.rs` 文字列検査）は P1 の `root_router.rs` 取込み後／P4 で対応。D8G/D8R は `find_domain_control_for_actor` を使い、block の関係解除・新規 Follow 拒否を実装する。

## 検証境界

| unit | 検証 |
|---|---|
| E8 | 上記 |
| D8P | 実 DB、正規化表（IDNA 等）、認可、同時更新、Profile 分離・移管 |
| D8G | 受信・送信・配送・block 更新の競合、重複、遅延 Accept。unblock 後の古い activity 再送で関係が復活しない |
| D8R | 実 DB・署名付き mock peer・配送競合・wire-level activity 検査（自分の Follow は元 Follow を参照する Undo、相手の Follow は Reject 等。domain block では AP Block なし。個別 actor block は Block と、解除の Undo(Block) を配送） |
| F8 | FA 経由の実 Emumet E2E、BFF 変換、UI・visual。投稿部分は mock／未接続と明示 |

### D8G 確定契約（Emumet PR #89、squash `931a686`、2026-11-10 マージ済み、queue completed、issue #83 closed）

- **到達範囲**: domain `block` の Follow への実適用のみ（受信・送信・Accept 反映・配送前判定）。mute は Follow を拒否しない。既存関係の一括解除（D8R）・投稿操作の拒否（ShuttlePub）・本番 mount / worker 起動（P4）・domain-controls の block 書込の本番有効化（D8R）は未実装。route・worker は本番未 mount のまま。openapi.json 変更なし。
- **ガード挿入点**: inbound `Follow`（`profile_inbound::handle_follow`、個別 block 判定の隣。P3i の「全て受理」コメントは置換済み）／inbound `Accept`（`handle_response`）／outbound `follow_profile`（follower の block × 相手 host、local 宛ては相手 Profile の block × follower host も）／配送 worker（`cancel_if_recipient_domain_blocked`、署名後・`renew_lease` の直前）／domain control 書込（`put_domain_control` / `delete_domain_control`）。照合は D8P の `ControlDomain::from_actor_id` / `applies_to_actor_id`（検証済み canonical actor ID の host 完全一致、mode=block のみ、inbox / sharedInbox / CDN の host は見ない）。
- **helper（D8R が使う）**: `application::service::domain_follow_guard::{domain_blocks_actor, lock_profile_for_domain_control_write}`、`ProfileRelationshipLock::lock_profile_row_shared`（kernel）。D8R の block 適用 transaction は `lock_profile_for_domain_control_write` を一度だけ関係の読み書きの前に呼ぶ。local 相手の関係も解除する場合は、相手 Profile を事前に特定して昇順の単一 `lock_profiles` にまとめる。未送信 Follow / Accept job の取消は `cancel_undelivered_for_follow`（in_flight も取消でき、worker は `renew_lease` で検出）。
- **ロック順**: Profile 行 `FOR SHARE` → advisory（`lock_profiles`、ID 昇順・transaction 先頭で一度だけ）→ job → Follow 行。以下、各項目の詳細。

- **拒否時の応答**: inbound Follow が domain block に該当したら、P3i の個別 block と同じ形 — `ended(blocked)` 世代（tombstone）を保存し `Reject(Follow)` job を同一 transaction で予約。Accept は作らず AP Block は送らない。packet の「拒否時は関係・Follow 世代・配送 job を作らない」は「**有効な関係は作らない（終了済み tombstone 世代と Reject job は作る）**」の意味に是正（ユーザー回答 question-d86e0448c6f71c124e501176f0b037b1）。outbound の拒否は何も作らない（422）。
- **遅延 Accept**: block 中の Accept は pending 世代を accepted にしない（世代は変更せず、受信は記録）。unblock 後の同一 Accept 再送も重複で無効。
- **配送前判定**: 署名後・`renew_lease` の直前に未送信 Follow / Accept を再判定し、block 中は取消 + 当該世代を `blocked` で終了。送信済みは取り戻せない。
- **ロック規約**: `ProfileRelationshipLock::lock_profiles`（ID 昇順・transaction 先頭で一度だけ）を、block を判定する／Follow を変更する全 transaction（inbound 受信 Profile、outbound の送信 Profile（follow / block は local 相手も）と unfollow（Follow 世代 → job の順で更新するため配送前判定と循環しないよう共通ロックで直列化。unblock / mute / unmute は不要）、配送前判定の送信元、domain control 書込の所有 Profile）が取得。D8R は `application::service::domain_follow_guard::lock_profile_for_domain_control_write` を使う。
- Follow だけが実適用対象（投稿操作は ShuttlePub、既存関係の一括解除は D8R）。
- **Profile 削除 CASCADE とのロック順**: Profile 削除（Account 無効化 projection）は Profile → Follow → job の順に行をロックするため、job → Follow の順に更新する配送前ガードは Profile 行 `FOR SHARE`（`lock_profile_row_shared`）→ advisory lock の順で取得。Profile 行 → advisory → Follow/job 行の順を守ること（owner 確認経路は `FOR SHARE`、inbound は FK insert の `FOR KEY SHARE`）。
- **気づき（既存挙動・対象外）**: `account_projector` は書込み失敗で rollback しても checkpoint を進めるため、Account 無効化の projection が再試行されず残留しうる。

### D8R 確定契約（Emumet PR #93、squash `82fa49b`、2026-11-12 マージ済み、queue completed、issue #84 closed）
- **到達範囲**: domain-controls（GET 一覧・GET/PUT/DELETE `/{domain}`、mute・block とも）を本番 `server/src/root_router.rs` に mount（`route_domain_controls`）。domain `block` の PUT（新規・mute からの置換・block の再保存）が、同一 transaction で対象 domain の既存関係を両方向に解除する。個別 actor block（`block_actor`）の AP Block / Undo(Block) 配送を含む（ユーザー決定 question-e6dfa2b98a9dc74491b19bbcf2ba5ca4、範囲追加）。**含まない**: 復元用関係一覧・解除時の復元・domain block の AP Block・投稿操作の実制御（ShuttlePub 後続）。「D08 本番適用完了」ではない。
- **解除処理（domain block PUT）**: `application/src/service/profile_relationship/domain_block.rs` と `service/domain_control.rs` の `put_attempt`。ロック（Profile 行 FOR SHARE → advisory → job → Follow、`lock_profile_for_domain_control_write` と同じ）の下で、所有 Profile の有効な Follow（pending 含む・following / followers 両方向）のうち、相手の検証済み canonical actor ID の host が対象 domain と**完全一致**するものを読み、block 保存後に `end_active_between` で両方向の有効な世代を終了理由 `blocked` で終了し、関係の作者ごとに後始末を予約する。途中失敗は block の保存を含め全体 rollback。外部配送の失敗・timeout は配送状態の問題でローカル適用は巻き戻らない。
- **最小通知予約の定義**: `Undo(Follow)` / `Reject(Follow)` のみ。domain block は AP `Block` を作らない。

| 関係の作者 | 未送信 job | 送信済み・結果不明 |
|---|---|---|
| 自分が送った Follow | Follow job を取消（相手は何も知らないので何も送らない） | 元 Follow を `object` に埋め込んだ `Undo(Follow)`（actor は自分）。送信中だった可能性（in_flight、cancel と claim の競合）があれば後述の起算で遅らせる |
| 相手が送った Follow | Accept job を取消し、元 Follow を参照する `Reject(Follow)` を予約。相手作成の Follow を自分が作者であるかのように Undo しない | 同上（送信中の Accept があれば Reject を遅らせる） |

- **後始末の起算時刻**: Undo / Reject の配送開始は、元 job の取消が済んだ後に取り直した時刻 + 120 秒（lease 期限が分かればそれ以降）。取消が行ロック待ちで遅れても元の送信より先に後始末が着地しない。Follow の Undo・Accept の Reject・Block の Undo に共通（`cancel_returning` 系が取消の瞬間の状態・lease を返す。**transaction 内で呼ぶこと**）。
- **個別 actor block**: `Undo(Follow)` / `Reject(Follow)` に加え、remote actor の inbox へ `Block`（`object` = 相手 actor、ID `{actor}/blocks/{block ID}`）を同一 transaction で予約。ローカル相手は配送しない。inbox は解決済み inbox → 同じ actor 対の最新 job → 解除した Follow から分かる inbox の順。`unblock_actor` は、未送信の `Block` は取消して Undo なし、送信済み・結果不明は元 Block を埋め込んだ `Undo(Block)`（相手に block が残り得るときのみ）。受信した Block / Undo(Block) は関係を変えない（P3i のまま）。
- **actor 対の整合と settle 下限**: 相手は actor 対で block を管理する（Undo(Block) は Block の ID を見ない）ため、block / unblock は actor 対ごとの advisory lock（`lock_block_pair`）の下で同じ actor 対の未配送 `Block` / `Undo(Block)` を先に取消す。取消の瞬間に送信中だった job があれば、新テーブル `profile_block_settle`（PK = 送信元 Profile × 相手 actor URL、`settle_not_before`）の下限を `GREATEST(取消後に取り直した時刻 + 120 秒, 取消時点の lease 期限, 既存値)` へ単調に引き上げ、以後その actor 対の Block / Undo(Block) は下限以上に始める。再ブロックで古い Undo(Block) が最新の Block を打ち消さない。`profile_block_settle` は初期化（reset）後も保持される。
- **migration**: `migrations/20261122000001_profile_delivery_block_activity.sql`（配送 job 種別の CHECK に `Block` を追加、`profile_block_settle` 作成）。P4 のコードは変更していない。
- **解除後の非復元**: DELETE（unblock）は関係を復元せず何も配送しない（個別 actor の unblock の Undo(Block) を除く）。復元用の一覧も持たない。解除後に古い Follow を再送しても世代は復活しない（P2 `ReplayedActivity`）。mute への置換・削除は何も解除しない。
- **自 host の domain を block した場合**: D8G の送信側ガード（local actor URL の host も対象）と整合させ、同じ host のローカル Profile との関係も解除する（配送なし）。ローカル相手は block 保存前に特定し、所有 Profile と併せて昇順の単一 `lock_profiles` で取る。ロック下の再読でローカル相手が新たに現れたら何も書かずに transaction をやり直す（最大 5 回）。
- **mount・CORS・OpenAPI**: root router に 4 operation を mount（mute・block とも全体）。CORS `allow_methods` に **PUT** を追加（DELETE は元から許可、許可リストは `cors_layer_for` に分離して preflight をテスト）。「未 mount 検査」は root router での mount 検査（無認証 401・所有者のみ 200・403/404/409/422）に置換。OpenAPI の「NOT MOUNTED / CONTRACT ONLY」注記を外して `openapi.json` を再生成。
- **分離**: 自分の block のみが対象で、同一 Account の別 Profile・他 Account の Profile の関係は変わらない。
- **検証（マージ時）**: 実 DB の workspace テスト application 283 / driver 361 / kernel 266 / server 214 passed（0 failed）、fmt・clippy -D warnings・OpenAPI 再生成差分なし、CI（E2E を含む全 job）green。署名付き mock peer の wire-level 検査（Undo/Reject の JSON・AP Block が出ない）、rollback、配送中競合、ロック変異検査を含む。
- **未確認・申し送り**: 実 peer（Mastodon）での Undo / Reject / Block の受理は未検証（Iceshrimp S10 と mock peer のみ）。domain block の E2E シナリオは mock peer が IP リテラル host で domain control を保存できないため未追加。`delivery::a_worker_that_lost_its_lease_while_signing_does_not_send`（P3o）と main の webhook テストに全体並列の高負荷時のみ失敗した例がある（単独・再実行で pass）。

### 個別 block/mute の actor 表示 API 確定（Emumet PR #106、squash `c4d6ea3a4f06e924e73ffa058e5ec6e2409f1e3d`、head `dcba931737c9149da99b16c29e952d7359db32ef`、2026-11-14 マージ済み、issue #104 closed）

- **到達範囲**: `GET/POST /api/v1/profiles/{profile_id}/mutes`・`/blocks` の `ProfileRelationResponse` に `target_actor` を加算。既存の `id / kind / profile_id / target / created_at` は不変。frontends の BFF・画面変更は含まず、別 unit の後続。
- **`target_actor` 契約**: `kind` は `local|remote`、`actor_url` は正規 actor URL（既存 `target` と同一）、`profile_id` は local のみ。`status` は `resolved|pending|unavailable`。`acct` は先頭 `@` なしの `preferred_username@host`（非既定 port は `host:port`）、`preferred_username`・`display_name`・`icon_url` と取れない値は null。local は Profile と画像から `resolved` を返し、remote は新設 `profile_remote_actor_cache` のみから返す。
- **取得・保存**: actor 表示情報を得るための外部 fetch は一覧・作成の応答処理中に行わない。応答 body を HTTP server が最後まで取り出した `Poll::Ready(None)` または破棄した `Drop` 後に best-effort のバックグラウンド取得を開始し、1 request 最大 10 件。これは socket flush / client receipt の完了を保証しない。DB lease は 60 秒、成功 TTL は 24 時間、失敗 backoff は 15 分。既存値がある更新失敗時は古い情報を保持して `resolved` のまま返す。actor `id` と要求 URL の完全一致、SSRF 対策、username/display name/icon URL の検証・サニタイズを行う。P4 cutover 処理には変更なし。
- **検証（マージ時）**: 新規 30 tests（application 11 / driver 9 / kernel 5 / server route 4 + OpenAPI 1）、workspace 全体 application 296 / driver 371（1 ignored）/ kernel 271 / server 229（2 ignored）pass。`cargo clippy --workspace --all-targets -- -D warnings`・`cargo fmt --check` clean。独立レビュー承認、CI 17 件全成功。
- **残余リスク・後続**: `pending` は再読込で解決しうるため URL 表示へ fallback する。`acct` は WebFinger 検証なしで actor URL の host から導出。`icon_url` は browser が直接読むため remote host に利用者 IP が見える可能性があり、proxy の要否は frontends 側で判断。未参照 cache row の掃除は未実装。取得は `tokio::spawn` の best-effort で、shutdown で失われても lease 失効後に再試行される。frontends の BFF/画面で `target_actor` を表示する作業は別 unit に引き継ぐ。

### F8 確定（shuttlepub-frontends PR #40 squash `cb02b99`・PR #46 squash `c88b96b`、2026-11-12 マージ済み、queue completed、issue #35 closed）

- **到達範囲**: 第1段 = 設定「ミュート・ブロック」画面（ui-spec v5 1-x・2-x、ドメイン・アカウント両タブ）＋ BFF ＋実 Emumet 接続（固定 OpenAPI は Emumet main 82fa49b。Follow 制御は実適用）。第2段 = 投稿表示面（ui-spec v5 3-1〜3-6・4-1〜4-5・5-1）と投稿／プロフィールの「…」メニュー（1-1）を、S8 生成 schema（ShuttlePub `60cb47d60da3c5b4ff3fc570fe3bc1796f983b3b` 固定、producer fixture も同 commit）準拠の mock で実装。
- **未接続の明示**: 投稿抑制・反応拒否の実適用は ShuttlePub 後続（S8 は契約のみ・全 route 501）。設定画面の注記に加え、投稿表示面にも mock 時「投稿の非表示・操作の制限はプレビューです（サーバー未接続）」を表示。real の投稿系は NOT_IMPLEMENTED。
- **reveal の保証**: 単一投稿 reveal はページ内限り（保存・同期しない、［隠す］・再読込・再訪・Profile 切替で隠し直す）。reveal してもブロック中の操作制限・CW・センシティブ・削除・閲覧権は解除しない。hidden 応答に本文・作者は載らない（BFF テスト）。要求番号で応答を照合し、［隠す］後・旧世代の応答を破棄。設定変更・409 回復で表示中の投稿を取り直し、取り直し中は旧 reveal（操作可否を含む）を使わず、失敗時は隠し表示＋エラー＋再試行。
- **ui-spec との差**: 3-4（引用の隠し表示に「引用しています／引用元」を出さない、引用を reveal しても引用元は隠したまま）は S8 優先。spec どおりにするには S8 契約の拡張が必要。1-6（アカウントタブの名前・アイコン・acct）は F8 時点では actor URL 表示だったが、Emumet API は PR #106 で `target_actor` を追加済み。frontends の BFF・画面接続は後続。通知・検索（5-2/5-3）は画面が後続 unit のため UI なし（BFF の S8 投影と fixture 検証のみ）。
- **ユーザー決定による差分修正（D08 q18）**: ui-spec 1-6 のアカウント行は案(a)を選択。Emumet mutes/blocks API は PR #106 で表示名・アイコン・acct 等を返すようになった。frontends の BFF・画面での表示対応は別 unit で行う（PR #106 の範囲外）。
- **純粋 boost の直接 URL**: boost wrapper 固有の画面・URL を作らず、元投稿 URL の通常の単一投稿 reveal に委ねる（TL では純粋 boost を全体ごと痕跡なく除く）。
- **検証（マージ時）**: 第1段は実 Emumet E2E（ローカル、2/2 pass ×2）。第2段は spago test・bun test 187・producer S8 fixture の再生一致・shuttlepub-verify（desktop/mobile、キーボード・モーダル・inert・Profile 切替・遅延応答・2 タブ 409）・visual（新規 18 枚）、CI 全 job green。
- **引継ぎ**: (1) 実 Emumet E2E シナリオのリポジトリ移設（`apps/shuttlepub-web/e2e`、Keto を含む compose、`e2e/emumet-revision` を Emumet main 82fa49b 以降へ）。(2) アカウントタブの actor 名等の Emumet API。(3) visual 撮影前のフォーカス待ち。(4) S8 契約拡張と ShuttlePub の実投稿制御。

## 責務の境界

- Emumet は新規 Follow のみ実適用する。投稿操作の受理・送信拒否は ShuttlePub の後続責務で、Emumet に重複実装しない。
- 完了報告で「D08 本番適用完了」と書いてはならない。到達範囲は [packets.md](packets.md) に記録する。

## UI 前提（ユーザー指示）

F8 の画面構成を決める実装はモック合意まで保留する。F8 の UI・visual の受け入れは画面構成のモック合意後に行う。
