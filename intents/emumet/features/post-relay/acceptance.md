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

## T1 — E2E acceptance / physical capacity / alarms 完了根拠 (2026-11-22)

対象は [Emumet PR #130](https://github.com/ShuttlePub/Emumet/pull/130)、承認 head
`4f584d2107c708c79b464c58c6900ffab9e44733`、squash
`439f7470990afbb79f286824fd59bb2b413a943a`。これは Emumet→P1 mock receiver の統合受け入れと
運用検証であり、ShuttlePub 本番 receiver、全P1サービスの本番準備、production SLOの認定ではない。
CIはマージ直前 **22/22 SUCCESS**。同PRで作成された最終E2E suiteは36 tests。
実 Kratos/Hydra/Keto、ソースから構築したserver、ローカル build の release image
`emumet-t1-release:local` を使用する。`receiver.rs` はlink台帳を持たず、P1署名・schema・envelopeを検証する。
`POST_RELAY_INBOX_ENABLED` の既定値は引き続きfalse。このcloseoutではGHCR publish、Git/release tag、
GitHub releaseは実行していない。CIの`:local`はテスト用ローカルimage名であり、公開物ではない。

### §11.1 必須30ケースと対応テスト

`server/tests/e2e_post_relay/` の統合テストをCIのpost-relay workflowで実行。
番号は承認計画§11.1に対応する。

| Case | 実証内容 | 対応テスト |
|---:|---|---|
| 1 | 実認証・Profile/link登録・署名inboxからrelay | `main::case01_real_auth_profile_link_signed_inbox_to_relay` |
| 2 | raw bytes・未知欄・非ASCII・空白の保持 | `intake::case02_raw_bytes_unknown_fields_non_ascii_and_whitespace_survive` |
| 3 | `to`文字列、actor object、IDなし、ld+json、array object | `intake::case03_to_string_actor_object_no_id_ld_json_and_array_object_are_forwarded` |
| 4 | 重複JSON key、type配列、元header上限 | `intake::case04_duplicate_keys_type_arrays_and_oversized_original_headers` |
| 5 | Follow/Block除外、既知/未知Undo・Accept・Reject | `intake::case05_follow_block_excluded_known_and_unknown_undo_accept_reject` |
| 6 | early-Undo防御、Profile間独立性 | `intake::case06_early_undo_defense_and_independent_profiles` |
| 7 | receipt保存後の失敗rollback・再送 | `intake::case07_failure_after_receipt_persistence_rolls_back_and_retry_is_not_lost` |
| 8 | 同Activityの複数Profile配信 | `intake::case08_one_activity_is_delivered_independently_to_multiple_profiles` |
| 9 | 未link時の本文なしhourly bucket | `intake::case09_unlinked_profile_leaves_only_a_body_free_hourly_bucket` |
| 10 | retry対象status・恒久失敗status・redirect拒否 | `delivery::case10_401_and_503_retry_400_403_409_permanent_redirect_rejected` |
| 11 | receiver受信後切断、同receipt/envelopeの再送 | `delivery::case11_receiver_accepts_then_disconnects_same_receipt_and_envelope_are_resent` |
| 12 | 保存後停止・再起動・lease回収 | `delivery::case12_stop_after_persistence_restart_and_lease_recovery` |
| 13 | P0/P1/P2/P4 × 解除3経路 × 自動/人手 | `races::case13_p0_p1_p2_p4_x_three_revokers_x_auto_and_operator` |
| 14 | HTTP停止中のunlink/deactivation/projector非待機 | `races::case14_stalled_http_does_not_delay_unlink_deactivation_or_projector` |
| 15 | 絶対send deadline超過後の送信禁止 | `races::case15_worker_past_its_absolute_send_deadline_does_not_send` |
| 16 | relink後に旧job/quarantineを新homeへ漏らさない | `lifecycle::case16_relink_never_leaks_old_jobs_or_quarantine_to_the_new_home` |
| 17 | 移管後link維持・新ownerだけ操作可能 | `lifecycle::case17_transfer_keeps_the_link_and_only_the_new_owner_can_operate_it` |
| 18 | suspend/BAN hold・deactivationによる解除 | `lifecycle::case18_suspend_ban_hold_without_extending_and_deactivation_revokes_even_if_the_profile_row_stays` |
| 19 | 同batch再有効化・古いevent再投影で新link保護 | `lifecycle::case19_deactivate_and_reactivate_in_one_batch_and_old_event_replay_keep_a_new_link` |
| 20 | Ory停止/応答停止中のrelay継続、認証API fail-closed | `ory_outage::case20_ory_stopped_or_unresponsive_relay_keeps_working_and_protected_apis_fail_closed` |
| 21 | 2プロセス間でquota/rate/reservation共有 | `retention::case21_two_processes_share_quota_rate_limit_and_reservations` |
| 22 | success/cancel後にjob・attempt・terminal rowなし | `retention::case22_success_and_cancel_leave_no_job_attempt_or_terminal_rows` |
| 23 | 注入時刻で72h/30d境界確認 | `retention::case23_72_hour_and_30_day_boundaries_with_injected_time` |
| 24 | worker競合下のProfile一括redeliver/discard | `operator::case24_profile_bulk_redeliver_and_discard_via_cli_with_competing_workers` |
| 25 | quarantine満杯でも新着拒否・受付済本文保持 | `retention::case25_full_quarantine_rejects_new_admission_but_keeps_accepted_bodies` |
| 26 | link台帳なしのP1 receiver検証 | `receiver_p1::case26_27_receiver_p1_procedure_rejects_every_defect_and_needs_no_link_table` |
| 27 | origin/Host/Digest/Date/schema不一致拒否 | `receiver_p1::case26_27_receiver_p1_procedure_rejects_every_defect_and_needs_no_link_table` |
| 28 | retention期限近傍のredeliveryでbytes/expiry維持・新署名 | `operator::case28_redelivery_near_the_retention_limit_has_a_fresh_signature_keeps_expiry_and_bytes` |
| 29 | live workerと並行するsource-built release-image操作 | `release_image::case29_release_image_operator_commands_run_beside_a_live_worker` |
| 30 | log/audit/CLI/counterへの本文・秘密・actor漏洩なし | `leak::case30_no_body_secret_or_actor_identifier_in_logs_audit_cli_or_counters` |

追加の容量・警報検証は `capacity::capacity_supply_every_30s_fails_closed_after_90s_and_applies_thresholds_with_hysteresis`、
`supplier::capacity_supplier_keeps_a_fixed_period_deducting_work_time_and_records_overruns`、および
`alarms.rs` のmissing/stale/low-capacity、quota/quarantine、reservation mismatch、purge delay、
deadline-near backlog、repeated 401、lock/connection pressure、projector stall、拒否理由counterの
fire/clear試験で行った。

### 容量・警報と§11.2の証跡

- `e2e/post-relay/capacity-supplier.sh` はPostgreSQL data volume（またはmanaged DBの同等指標）を
  fixed cadenceで30秒ごとに測り、`server capacity report`へ通知する。測定時間を周期から差し引き、
  overrunを記録し、失敗時に健康値を捏造しない。時刻は計測前にvalidation対象DBのclockから得る。
  90秒超・欠損・未来時刻・閾値未満はfail-closed。10 GiB未満または10%未満で受付停止、
  回復は12 GiB以上かつ12%以上を要求。
- DB警報は80% warning / 95% critical quota、capacity missing/stale/threshold、
  reservation mismatch、purge/cancel backlog、deadline-near、401、DB lock/connection pressure、
  projector stall等を確認する。拒否理由counterは固定code
  (`global_rate`, `profile_rate`, `profile_quota`, `global_quota`, `quarantine_full`, `capacity`,
  `storage`)を使い、拒否ごとのDB行を作らない。持続拒否alertは`storage`以外の理由別counter
  増加を検出する。runbookはmerged childの
  [operations guide](https://github.com/ShuttlePub/Emumet/blob/439f7470990afbb79f286824fd59bb2b413a943a/docs/post-relay-operations.md)
  に記録。
- §11.2 throughput計測はRyzen 9 7900 / Linux 7.3.5 / release / PostgreSQL 17、
  sender 4 cores＋8 GiB virtual-address-space制限、4 origins・16 Profiles、loopback plain HTTP
  （TLSなし、host共用負荷あり）で実施。64 KiBは125.38/s serial・185.93/s bounded-16、
  約1.34 MiBは93.88/s・167.28/s。目標100/s・20/sをこの条件で満たした。
  10分runは113,664 delivery / 600.05 s (189.43/s、admission込み)、KDF 1回、live rows・
  connection/RSSはbounded。timeout origin併設のhealthy throughput比は1.0144 (目標0.80以上)。
- Final-code physical-stability runは専用PostgreSQL 17.9 clusterで135,104 deliveries / 600.12 s
  (225.1/s)、DB relation size 35.0 MBでplateau、WALはmax_wal_size内で循環、autovacuumと
  bounded dead tuplesを確認。これらは本番SLO・4-vCPU VM・TLS性能の主張ではない。
  高圧縮bodyによりexternal TOASTは0 bytesで、この試験では外部TOAST growth/vacuumを検証していない。
- T1の測定はE2E suiteが33 testsだった時点で行い、最終36-test suiteまでの追加変更はcapacity-report
  refusal code、DB-clock sample validation、test-mode専用operator transport/utoipa記述などdelivery
  path外。throughputは再測定していない。物理安定性はfinal codeでも計測済みである。

### 計画外の追加と未解決事項

- 計画外の実装追加: capacity-reportの固定refusal reason code、DB clockによるcapacity sample
  timestamp検証、test-mode限定のoperator transport/utoipa記述。test-mode loopback例外は通常buildに含まれない。
  追加検証としてsupplier固定周期・overrun、未来timestamp診断、理由別拒否counterの持続alertを含めた。
- 未解決: 既存`e2e_basic_flow`とprojection再投影の競合は残存し、T1では修正していない。
  `check_reservations`にはproduction callerがなく、運用上の整合性確認は`alerts.sh`のread-only
  `consistency.sql`が担当する。
- 拒否理由counterとその持続alertはprocess-local。複数server運用では各processのlogを個別に監視する必要があり、
  process再起動でcounterの連続増加判定がリセットされる。external TOASTを含むincompressible bodyと
  populated quarantineのvacuum負荷も未検証。固定arrival負荷、TLS、production storage/scaleも未測定。
- host repoにはEmumet child submodule/.gitmodulesがないためsubmodule pointer syncは非該当。
  PR mergeでissue #128はCLOSED。PR/issue/queue/runのlinkageはintent-cliで記録した。
