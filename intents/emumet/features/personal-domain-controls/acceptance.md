# personal-domain-controls — acceptance

> 契約・検証境界。overview は [overview.md](overview.md)。個別 unit の受け入れ詳細は各 packet が正本。

## D08 全体の受け入れ（全 unit 完了時。現時点では未達）

- [ ] Profile P の mute で表示が抑制され既存関係は残る。block では表示抑制＋既存 Follow／Follower の両方向解除
- [ ] P の設定は同一 Account の別 Profile Q・他 Account の Profile に波及せず、全体 HostModeration も発生させない
- [ ] 設定は実保存され再取得後も適用される（D8P）
- [ ] block 対象 domain から P への新規 Follow、P から対象 domain への新規 Follow を拒否（D8G）。mute は拒否しない
- [ ] block で pending を含む両方向の関係が解除され、AP Block は送らず最小限の通知のみ。外部障害でもローカル適用は成功（D8R）
- [ ] 解除後も関係は復元されず、復元用一覧も保持されない。再フォローは利用者操作
- [ ] 完全一致のみ（`sub.example.com` に `example.com` の設定は適用されない）
- [ ] 返信・引用・リポスト・いいね／絵文字の新規受理・送信拒否、表示抑制（ShuttlePub 側・後続 unit）
- [ ] UI から実ログイン→実方針保存・取得→Follow 解除まで確認（F8）

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
| D8R | 実 DB・署名付き mock peer・配送競合・wire-level activity 検査（自分の Follow は元 Follow を参照する Undo、相手の Follow は Reject 等。AP Block なし） |
| F8 | FA 経由の実 Emumet E2E、BFF 変換、UI・visual。投稿部分は mock／未接続と明示 |

## D8G 実装メモ（Emumet PR #89。マージ後の確定は親の closeout）

- **拒否時の応答**: inbound Follow が domain block に該当したら、P3i の個別 block と同じ形 — `ended(blocked)` 世代（tombstone）を保存し `Reject(Follow)` job を同一 transaction で予約。Accept は作らず AP Block は送らない。packet の「拒否時は関係・Follow 世代・配送 job を作らない」は「**有効な関係は作らない（終了済み tombstone 世代と Reject job は作る）**」の意味に是正（ユーザー回答 question-d86e0448c6f71c124e501176f0b037b1）。outbound の拒否は何も作らない（422）。
- **遅延 Accept**: block 中の Accept は pending 世代を accepted にしない（世代は変更せず、受信は記録）。unblock 後の同一 Accept 再送も重複で無効。
- **配送前判定**: 署名後・`renew_lease` の直前に未送信 Follow / Accept を再判定し、block 中は取消 + 当該世代を `blocked` で終了。送信済みは取り戻せない。
- **ロック規約**: `ProfileRelationshipLock::lock_profiles`（ID 昇順・transaction 先頭で一度だけ）を、block を判定する／Follow を変更する全 transaction（inbound 受信 Profile、outbound の送信 Profile ＋ local 相手、配送前判定の送信元、domain control 書込の所有 Profile）が取得。D8R は `application::service::domain_follow_guard::lock_profile_for_domain_control_write` を使う。
- Follow だけが実適用対象（投稿操作は ShuttlePub、既存関係の一括解除は D8R）。

## 責務の境界

- Emumet は新規 Follow のみ実適用する。投稿操作の受理・送信拒否は ShuttlePub の後続責務で、Emumet に重複実装しない。
- 完了報告で「D08 本番適用完了」と書いてはならない。到達範囲は [packets.md](packets.md) に記録する。

## UI 前提（ユーザー指示）

F8 の画面構成を決める実装はモック合意まで保留する。F8 の UI・visual の受け入れは画面構成のモック合意後に行う。
