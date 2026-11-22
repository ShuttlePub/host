# post-relay — acceptance criteria

> See [overview.md](overview.md) for goals.

## Criteria

- [ ] _[Criterion 1]_
- [ ] _[Criterion 2]_

## Q1 — durable storage 完了根拠 (2026-11-21)

対象は [Emumet PR #122](https://github.com/ShuttlePub/Emumet/pull/122)、squash
`7efe25c7b5e5237d4246e74b7c50903996040b14`。以下は Q1 の保存 port の検証であり、
P1 全体・本番負荷 SLO・I1/S1/T1 の未実装機能の合格を意味しない。

- [x] 受付と予約の同一 transaction / rollback、並行件数・bytes 上限、全失敗時の予約を実 DB で確認。
  `post_relay_atomic_receipt_reservation_rollback_and_old_receipt_is_not_delivery_evidence`、
  `post_relay_concurrent_admission_enforces_count_and_bytes_and_reserves_every_failure`、
  `post_relay_concurrent_byte_limit_is_not_just_a_row_limit`。
- [x] L1 の 3 解除経路で旧 link/generation の新規許可を fence し、同一 transaction で論理予約を解放。
  全容量時の Profile 1.997 ms / 残る 7 Profiles の Account 6.705 ms、128 本文 purge 最大 16.915 ms。
  非圧縮一括物理削除の 7 Profiles は 3,000.221 ms timeout のため bounded purge を採用した。
  条件・未消去の物理本文・本番性能との区別は [decisions.md](decisions.md) の Q1 結果を参照。
  `post_relay_full_profile_and_multi_account_logical_cancellation_is_bounded` と server の
  `post_relay` 3 経路試験が根拠。
- [x] 未 link の集計 header 込み global 100,000 / Profile 1,000 行と専用 rate bucket を linked 配送枠から分離。
  `post_relay_unlinked_hourly_bounded_and_exhaustion_does_not_spend_linked_reservations`、
  `post_relay_rate_is_shared_by_two_separate_processes_not_process_local`。
- [x] 隔離/audit は論理的終端＋720 h。72 h 経過後の遅い回収・hold・再起動は期限を延長しない。
  期限内の成功/恒久失敗観測は現行 attempt/token/lease/link 検証後に優先する。
  `post_relay_late_collection_never_extends_logical_terminal_or_quarantine_retention`、
  `post_relay_absolute_30_day_retention_is_timezone_independent_across_dst`、
  `post_relay_p4_in_deadline_results_survive_delayed_record_but_not_unlink_or_wrong_attempt`、
  `post_relay_p4_lease_expiry_rejects_completed_response_and_uses_original_cutoff`。
- [x] 30 日後の quota purge 後の旧 token、再 link 前の未 link header、旧 operator ID、
  quota 不整合の取消でも容量を再確保しない。R1 の以下 3 件は旧 head `054cf39` で失敗、
  承認 head `32b6d86` で成功した。stale lease 試験では `Stale` の transaction も commit し、
  全容量 snapshot が変わらないことを確認した。
  `post_relay_stale_operations_after_quota_purge_never_recreate_or_convert_capacity`、
  `post_relay_old_operator_batches_after_quota_purge_never_recreate_capacity`、
  `post_relay_cancellation_with_missing_quota_fails_without_reinitialization`。
- [x] `server capacity report` の help、厳密 schema 照合・migration 不適用、freshness/閾値・単調時刻を確認。
  `post_relay_capacity_unknown_stale_thresholds_hysteresis_and_mismatch_fail_closed`、
  `post_relay_empty_and_populated_main_migration_operator_refuses_mismatch_without_migration` と
  server integration `post_relay_capacity` 3 件。共有状態の供給元は T1 が用意する。
  docs facet は `docs/post-relay-storage.md` の「Physical-capacity writer」を同等内容として確認した。
  宣言の `docs/post-relay-operations.md` は未収録で S1/T1 が作成・運用手順を集約予定
  ([decisions.md](decisions.md) に差異を記録)。
- [x] 成功 256/768 件時点で body/job/attempt/dead-letter/audit/link-usage は残らず、固定状態だけ。
  `post_relay_success_volume_leaves_only_fixed_state_not_receipt_terminal_rows`。
- [x] 承認 head のローカル Q1 は kernel 1＋driver 30＋server 2＋capacity CLI 3 = 36 成功、
  失敗/ignored 0。DB 試験は PostgreSQL 17.9 の独立 DB で実行。追加 L1 server 13 件、fmt、
  workspace/all-targets clippy (`-D warnings`)、OpenAPI 差分なしを確認。
  独立再レビューは must/任意とも 0。merge 直前の GitHub checks は 21 件すべて SUCCESS。

## S1 — signed delivery / operator recovery 完了根拠 (2026-11-22)

対象は [Emumet PR #125](https://github.com/ShuttlePub/Emumet/pull/125)、承認 head
`1895554930fb2e9c7f33b742aa1ca6488265f56e`、squash
`e26fcede7d3d1f6936c821cb668f9a6f262688cd`。これは S1 の完了であり、I1 の受付有効化、
T1 の監視統合や実 TLS/本番 SLO の認定ではない。詳細条件と制約は [decisions.md](decisions.md) の S1 結果。

- [x] 許可 commit/絶対期限と P0–P4、解除 3 経路 (unlink / Account command / projector) × 自動/人手を実 DB で確認。
  `s1_p0_p1_p2_p4_three_revokers_auto_and_manual_no_body_resurrection`、
  `s1_unlink_gate_and_precommit_checkpoints_three_revokers_auto_manual`、
  `s1_p3_silent_http_has_zero_db_holds_and_all_revokers_finish`、
  `s1_p1_timeout_rollback_does_not_send_and_p2_expired_does_not_send`。
  HTTP 中は pool idle / DB lock なし。30 s silent peer の間の解除は以前の実測 1.3–6.7 ms、今回も P3 回帰成功。
- [x] 共有 global16/origin4/準備 lease 枠、Profile rotation、飽和 origin 除外と期限 job を検証。
  R1 の `s1_scheduler_recently_served_profile_deadline_survives_last_origin_slot` は修正前に fresh job を選んで失敗、
  修正後に最近送信済み Profile の残り 1 s job を選択。既存公平性試験も成功。
- [x] R2 の `s1_scheduler_stalled_claimer_times_out_rolls_back_and_recovers`、
  `s1_scheduler_transaction_budget_includes_time_before_claim_and_rolls_back`、
  `stalled_claim_does_not_block_maintenance_or_shutdown` は修正前失敗、修正後成功。
  lock 2 s / statement 3 s / idle と transaction 全体 5 s を緩和せず、上位 gate を追加しない。
  停止 client の object を保持したまま DB idle 終了と別接続の fresh fencing 回収を確認。
  `s1_scheduler_statement_timeout_rolls_back_its_uncommitted_lease`、transaction-local 設定の pool 非漏出も成功。
- [x] R3 の `s1_scheduler_measures_connection_lock_and_each_jobs_ready_queue_separately` で pool/lock/queue の独立感度を確認。
  分離測定定義・分布と 600 s 待ち内訳は merge commit の `docs/post-relay-measurements.md` に収録。
  queue は preload を含む due_at→claim、lock は往復込み取得 latency と明記し、純粋な blocked-time 分布とは主張しない。
- [x] 修正後 4 cores / 8 GiB-AS / release / plain HTTP は 64 KiB 230.13/418.00 件/s (直列/並行16、目標 ≥100)、
  1,400,000 bytes 149.79/259.85 件/s (≥20)、timeout origin 混在の正常側比率 0.9987 (≥0.80)。
  600.18 s / 176,576 件 / KDF 1 回、RSS/接続/固定行数は有界、生存行の増加なし。測った目標に未達なし。
  TLS、実 VM/cgroup、4 origins/16 Profiles 超の規模は未測定のまま可視化する。
- [x] instance 署名/固定 bytes、401 再送、403/409 恒久失敗、redirect/SSRF/DNS rebinding、期限内観測と stale 結果、
  expiry/保持の既存 S1/Q1 試験を維持。成功・取消の件数比例 terminal 行は残さない。
- [x] shipped `server --help` / `server post-relay --help` から preview→確認 redeliver/discard→status に到達。
  `server/tests/post_relay_operator.rs` 2 件で厳密 schema 拒否・migration 不適用・最小初期化・WORKER_ID 非依存を確認。
  release image operator 2/2 と Cargo/source 不在 smoke は前 head の証跡で、R1–R3 後に独立再実行したものではない。
  image の redelivery 対象は 0 件で、任意の非空 image 再配送は未追加。この範囲を全成功と混同しない。
- [x] sender-only 停止設定、手動拒否、expiry/purge 継続、全送信停止/egress 遮断との差、継続受付時 quota 増加を
  宣言どおりの `docs/post-relay-operations.md` に収録。数値・待ち内訳は追加の measurements 文書を併用。
- [x] 最終 functional/test head の fmt、workspace/all-targets clippy (`-D warnings`)、新鮮な PostgreSQL 17 DB の
  `cargo test --release --workspace` は失敗 0 (application 374、driver 474、kernel 277、server 270 ほか)。
  DATABASE_URL 試験は skip なし、明示 ignore の外部 E2E fixture はローカル成功に含めない。
  benchmark は別途明示実行、最終承認 head の CI は 21 件すべて SUCCESS。再レビュー must なし。
- [x] PR は MERGED、issue #123 は CLOSED、host queue/runs は `completed`、linkage は CLI で PR #125 に回復。
  host に child submodule / .gitmodules はなく pointer sync は該当しない (closeout-plan の既定候補パスを作成しない)。

## I1 — Profile inbox relay intake 完了根拠 (2026-11-22)

対象は [Emumet PR #126](https://github.com/ShuttlePub/Emumet/pull/126)、再レビュー承認 head
`7a273a25a2a5c0cdeacc0253788a8d48a7552f3b`、S1 上 rebase 後の最終 head
`cb1494841e7cf16ba5d632148ea269bb29d1c671`、squash `b054788aa253ad99ea3c49c12f239e9baf5bba1c`。
これは受付経路の実装完了であり、`POST_RELAY_INBOX_ENABLED` の有効化・T1 の監視供給・実 TLS/本番 SLO の認定ではない。
詳細は [decisions.md](decisions.md) の I1 結果。

- [x] `POST_RELAY_INBOX_ENABLED` 既定 false、`true` のみ有効、不正値/非正規 origin は起動失敗。off では job/未リンク集計を作らず
  既存 Follow・early-Undo 防御は継続。off は新規受付のみ停止で S1 の緊急停止ではない。
- [x] 1 MiB 本文/2048 target/MIME、生 byte の署名検証 (検証結果の key/owner を使用)、重複 key・深さ・node 上限を実装。
  C0 fixture 全件で production reader/evidence builder を検証 (`post_relay_contract`)。
- [x] D63: Follow/Block 除外、Undo/Accept/Reject は全参照が確実な Follow/Block のときだけ除外、欠落/空/混在/不明は全文転送。
  guard marker 非証拠 (`observed_relation`、populated backfill 試験)、Duplicate は転送を抑止しない。
- [x] 転送 2048 / 旧関係 1024 の分離: 1025–2048 ID は envelope に保持、>2048 は null、旧関係変更は skip、実検証 owner を維持。
  外側 Undo ID が長い場合も guard を同 transaction で残す。DB 制約/index は無変更。
- [x] 1 Q1 transaction の原子性 (receipt/guard 後の SQL 障害で全 rollback、過負荷・最後の quota slot・同一 hour bucket 競合)、
  202 は commit 後。`profile_relay_tests` を含む workspace を DATABASE_URL 付きで skip なしに実行。
- [x] 受付計測: 4,096 件 202、429/503 なし、202 p99 ≤140.22 ms、RSS ≤51.2 MiB、intake pool ≤4。bounded probe であり SLO ではない。
- [x] rebase 後 (S1 e26fced 上) の fmt、workspace/all-targets clippy (`-D warnings`)、openapi.json 再生成 (差分なし)、
  新鮮な PostgreSQL DB の `cargo test --workspace` は失敗 0 (application 374、driver 474、kernel 277、server 281 ほか)、CI 19 件すべて SUCCESS。
  migration 順序は S1 `20261122000400` → I1 `20261122000500`。
- [x] PR は MERGED、issue #124 は CLOSED、host queue/runs は `completed`、linkage は CLI で PR #126 に回復。

> 2026-11-22 訂正注記 (D68): 上の I1 の `POST_RELAY_INBOX_ENABLED` 既定 false は「運用上の安全弁」ではなく、
> 転送先の ShuttlePub の受け口がまだないための措置である。オンにする条件と時期 (初回リリース時に受け口がそろっていればその時点、
> そろっていなければ受け口の完成時) は [D68](../../../shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md) を参照。
> 有効化は T1 までの未達事項ではなく、ShuttlePub の受け口の完了条件と Emumet の初回リリースの完了条件に入っている。

## B1 — Ory-independent runtime / bounded shutdown 完了根拠 (2026-11-22)

対象は [Emumet PR #129](https://github.com/ShuttlePub/Emumet/pull/129)、独立再レビュー承認 head
`65c738bf7c23181a47a07b2e77bc6b2a8b643368`、squash `5b0b7b53718cb5181e903efb46515404e2346fe9`。
以下は B1 の完了であり、I1 inbox の有効化条件 (D68)、T1 の監視/full real-user E2E、本番 SLO の認定ではない。
設定の具体化一覧・測定条件・制限は [decisions.md](decisions.md) の B1 結果と merged child の
[docs/post-relay-operations.md](https://github.com/ShuttlePub/Emumet/blob/5b0b7b53718cb5181e903efb46515404e2346fe9/docs/post-relay-operations.md) を参照。

- [x] B1-1/2: refused/stalled discovery・fetch headers/body は期限付き。migration/Profile/instance 鍵確認後に listener を bind、
  JWKS warm-up 完了は待たず I1 inbox/S1 worker を統合。Ory 不在でも instance 文書と実署名 inbox→転送を確認。
  `post_relay_runtime_cold_start_outages_serve_instance_and_forward_signed_inbox`、
  `stalled_discovery_is_bounded_and_failed_attempts_are_single_flight`、`stalled_jwks_headers_and_bodies_are_bounded`。
- [x] B1-3: 未取得 JWKS は fail-closed、cached/uncached 成功と issuer/audience/expiry/kid を維持。
  `refused_discovery_and_uncached_authentication_fail_closed`、`uncached_acquisition_then_cached_outage_preserves_validation`、
  `failed_or_empty_warmup_recovers_before_cached_refetch_interval` を含む auth/JWKS 13 件が成功。
- [x] B1-4/7/9: 空 migration/既存 DB 再起動で同じ instance identity/鍵を維持、sender off で claim/送信しない。
  seed と live projector の競合は子プロセス退出後の fixture 作成へ修正し、off 再起動→on 再起動の双方を検証。
  `post_relay_runtime_empty_migration_and_stopped_sender_preserve_populated_restart`。
  A1 login/consent 実装には変更を混ぜず、既存 `e2e_basic_flow` 6/6 (実認証 3 ケースを含む) と最新 CI E2E が成功。
- [x] B1-5: SIGTERM で HTTP drain より先に claim 停止、stalled inbound/outbound を共通期限内で drain。
  `post_relay_runtime_sigterm_stops_claims_before_http_drain_and_bounds_stalled_work`。
  実 libc DNS 20 s 停止の `post_relay_runtime_sigterm_bounds_blocking_dns_runtime_teardown` は修正前 4 s 上限で失敗、
  同じ絶対期限を runtime teardown まで適用後は 2 s 設定で 2.003/2.006 s 退出 (最終試験上限 3 s)。
  async drain 満了を伴う反例でも追加の teardown 猶予は与えず、resolver が未完のまま退出したことを marker で確認。
- [x] B1-6: `post_relay_runtime_sigkill_before_and_after_authorization_recovers_original_lease` で
  許可前/後の実 SIGKILL→元の 30 s lease 満了→再起動回収を確認。S1 fencing/期限/送信方針を変更しない。
- [x] B1-7/8/9: I1 inbox 既定 false、S1 sender 設定、既存 Profile 配送、認証 validation を維持。
  migration/OpenAPI/`ory/hydra/hydra.yml` の変更なし。OpenAPI generator 1 件成功・生成差分なし。
- [x] fmt と workspace/all-targets clippy `-D warnings` は通常/test-mode とも成功。production 同一の `20f446b` で
  workspace 実 DB 1414 件成功 (app 374/driver 474/kernel 277/server 288/recovery CLI 1)、失敗/ignored 0。
  measurements/live Cloudflare/別途 D15 fixture/OpenAPI generator のみ明示 filter、必要 DB 試験は skip なし (D15 は CI 成功)。
  最新 head の all-features 実プロセス 5/5、CI は [B1 DB/process](https://github.com/ShuttlePub/Emumet/actions/runs/44985739155/job/137095774029)、
  [coverage](https://github.com/ShuttlePub/Emumet/actions/runs/44985739775/job/137095798720)、既存認証 E2E を含む 21/21 SUCCESS。
- [x] PR は MERGED、issue #127 は CLOSED、host queue/runs は completed、linked_pr は CLI で PR #129 に回復。
  host に child submodule/.gitmodules はなく pointer sync は非該当。宣言済み intent_tree/docs/closeout_learning は
  host knowledge と merged child operations 文書で満たし、CLI の design/orchestration 証跡をそれぞれ記録する。
