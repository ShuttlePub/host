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
