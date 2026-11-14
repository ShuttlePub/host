## Goal

D08 受け入れ must: 切替前に無効化された Account の Profile も username 前提検査・起動時鍵初期化の対象にし、再有効化直後に同じ identity と鍵で actor が復帰する。

## Why This Slice Exists Now

D08 受け入れ must 指摘を修正する。

## Current Observed State

最新 Emumet origin/main 8b6ceb4 で静的確認: 無効化で profiles が削除され、P4 の username 検査と PostgresProfileSigningKeyRepository::find_profiles_without_active_key は FROM profiles のみ。Account projector の restore_owned_profiles は全履歴を復元するが鍵を生成しない。P4 #91 (daeb625) / P1 #78 の鍵必須判定により、切替前無効化 Profile が取りこぼされる。

## Accepted Baseline You May Assume

- 全既存 Profile に鍵、username 未設定が残れば切替拒否（host ADR §5, §7）。
- profile_events は保持される。ProfileEvent に Deleted はなく Created の id/nanoid は不変。username は一度だけ設定。
- profile_signing_keys は profiles から独立して保持する。新規 Profile は作成 transaction で鍵を生成。
- 最新 origin/main を base とし、既存 migration の checksum は変更しない。

## Target Repo / Path / Part

Repository: ShuttlePub/Emumet

Target paths: migrations/, driver/src/database/postgres/, server/src/cutover_tests.rs, docs/profile-federation-cutover.md, .github/workflows/

Target part: 全既存 Profile の切替安全性。

## In Scope

- 前提検査をイベント上の全既存 Profile に広げ、username 未設定の無効化 Profile が 1 件でもあれば破壊的 P4 migration の前に拒否する。
- 鍵生成候補を profiles と Profile Created イベントの identity の和集合に広げる。既存鍵・nanoid は不変、未射影でも鍵を保持。
- 適用済み migration の checksum を変更しない。追加の事前検査を P4 より前の番号で採番し、既に P4 適用済み DB の互換性も検証する。
- 切替前無効化→切替→再有効化の実 PostgreSQL 回帰テスト、username 未設定拒否・復旧、冪等性・既存鍵不変、既存回帰を追加・実行する。
- runbook の全 Profile の定義・事前確認 SQL・復旧手順・イベント履歴が必要な理由を更新し、新回帰を CI の DATABASE_URL 有りで実行する。

## Out Of Scope

本番 P4 カットオーバー・本番 DB 操作・デプロイ、PR マージ、旧連合 identity の変換・dual-write、Profile 削除仕様の追加、無関係な D08/UI 改変。

## Standalone Child Issue Contract

D08 受け入れ must: 切替前に無効化された Account の Profile も username 前提検査・起動時鍵初期化の対象にし、再有効化直後に同じ identity と鍵で actor が復帰する。 対処は前提検査・鍵生成を event 上の既存 Profile まで広げる。未射影 Profile を一律拒否するより ADR に直接沿い、無効化状態を維持できる。起動時に全ての鍵を確保するので reactivation projector へ鍵生成を追加しない。既存鍵を再生成せず、新規作成時の transaction 内生成を維持する。

## Acceptance Criteria

- 無効化 Profile が username 設定済みなら、無効化状態を保ったまま切替時に鍵を生成し、再起動せず再有効化後 actor 200 と publicKey を確認できる。
- 無効化 Profile の username が未設定なら P4 前に拒否し、旧連合データ・台帳・migration 状態に破壊的変更がない。復旧して再試行できる。
- 既存鍵の再生成・上書き、旧鍵の変換、新しい署名 REST API、暗黙の Account 再有効化をしない。
- 実 PostgreSQL テスト (DATABASE_URL 必須、skip のみ不可) と既存回帰、fmt/clippy、CI が成功する。PR は main 向け、Closes #issue を含み、マージしない。

## Verification

DATABASE_URL を設定した既存 IsolatedDatabase の流儀による実 PostgreSQL テスト。切替前無効化→起動相当の migration/鍵生成→再有効化→本番共有 router の actor 200・鍵検証、未設定 username の拒否と復旧、複数回初期化の不変性、P4 適用済み DB の追加 migration 互換性、既存 cutover/lifecycle/driver/application 回帰。cargo fmt --check、cargo clippy、cargo test、git diff --check。テスト件数と skip を区別して記録。

## Related Links

- https://github.com/ShuttlePub/Emumet/pull/91
- https://github.com/ShuttlePub/Emumet/pull/78
- https://github.com/ShuttlePub/host/blob/main/intents/emumet/decisions/profile-federation-in-place-reset.md

## Knowledge Maintenance

- Intent placement: profile-federation（既存）
- ADR candidate: 既存 in-place-reset にレビュー後 closeout で追記
- Diagram candidate: なし
- Docs update: docs/profile-federation-cutover.md
- Closeout writeback expected: yes（host が行う、child に parent state を作らない）

## Guide Reachability (G645)

No new CLI/role-facing guide surface. 既存 runbook を修正する。

## Base Branch Policy

Policy: direct-main
Expected PR base branch: main

## Authority / delivery boundary

ユーザー thread-xxs52dcx の今回の明示指示。本 unit は PR と CI 緑まで。マージ禁止、本番切替・本番 DB・デプロイ禁止。PR body に Closes #issue を記載する。
