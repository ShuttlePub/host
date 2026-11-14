## Goal
profile-federation-precutover-recovery: P4 前の無効化 Profile を安全に診断・username 設定

## Why This Slice Exists Now
#105 の全既存 Profile 検査により、旧版の古い無効化 Account で復元できない Profile に username がなくても安全に拒否されるが、旧版再有効化では復旧できない。ユーザー決定「P4切り替えはbで」により先行 unit で解消する。

## Current Observed State
P4 前 daeb625^ の Account projector は deleted 行を除く lookup と tailing-window に依存。現 runbook §3.1 は復元不能なら停止。最新 main は c2da7f6。

## Accepted Baseline You May Assume
- FN/P1 の UsernameSet・username 一意/一回限り index は P4 前にある。
- Profile に Deleted イベントはない。Created の id/nanoid は不変、AccountTransferred で所有者が変わる。

## Target Repo / Path / Part
Repository: `ShuttlePub/Emumet`
- Target paths: driver/src/, server/src/cutover_tests.rs, docs/profile-federation-cutover.md, .github/workflows/lint-and-test.yml
Target part: P4 を起動しない offline recovery command

## In Scope
専用診断・明示個別 UsernameSet 管理コマンド、永続監査、実 PostgreSQL 回帰、runbook。

## Out Of Scope
本番操作、マージ、切替実行、projector backport/行復元/Account 自動再有効化、username 除外、手書き SQL 書込手順。

## Standalone Child Issue Contract
## 採用設計と根拠

前提: 全既存 Profile（射影行と全イベントの和集合）を対象とし、username 未設定が残れば切替拒否、切替後に鍵のない Profile を残さない。

採用: 選択肢 (3) の offline 管理経路。standalone driver binary が SQLx 接続を直接開き、AppModule/PostgresDatabase::new/migrate を呼ばず、既存 ProfileEventStore と Profile::apply で全履歴を読む。運用者が個別選択した username を旧版も理解する UsernameSet として append。行がなければ作らず、Account 状態・鍵・旧連合テーブルは不変。全既存対象・username 一回限り・一意性の不変条件を維持する。

比較: (1) 完全復元コマンドや (2) projector backport は再有効化/公開状態を変える経路と旧版専用 release の保守を増やす。本件は username 設定だけで切替拒否を解消でき、全履歴の読取りで旧 tailing-window バグを回避できるため不要。読み取り専用診断は併設する。

安全境界: 旧プロセス全停止/バックアップが前提。diagnose と set-username の既定 dry-run は read-only transaction。write 時は対象テーブルをロックし再検査、期待 Profile version を比較、username 形式と既存 reservation を検査。既存の username を変更/自動導出/除外しない。P4 migration 適用済み・不明な schema・復元不能履歴は fail closed。成功イベント/射影更新/専用監査行を一 transaction、request ID の同一引数再送は冪等 no-op、変更再送は拒否。operator/reason と対象/前後 version/username を保持。

専用監査表はコマンドの明示 write 時に非破壊 CREATE TABLE IF NOT EXISTS で導入（同 transaction）。新 migration を通常起動へ追加して P4 を誘発しない。失敗は非ゼロとエラー出力、運用者がコマンド出力も保管する。

非目標: Account 再有効化、projection 完全復元、projector backport、通常 API の権限変更、username の除外、P4 checksum 変更、汎用署名 API、本番 DB 操作、本番切替、PR マージ。

## Acceptance Criteria
- P4 migration/通常サーバーを起動しない独立コマンドで、全既存 Profile（行＋全イベント）の username・現在の所有 Account・無効化/未射影状態を読み取り専用診断する。移管後の所有者も特定する。
- 運用者が個別指定した username を既存 UsernameSet イベントとして記録し、行があれば同期更新する。無効化 Account/Profile の再有効化・行復元・意図的除外・P4 検査緩和はしない。
- 既定 dry-run、明示 write、操作者/理由/request ID/期待 version、transaction と競合拒否、再実行の冪等性、永続監査ログ。P4 適用済み/不整合/競合する username は拒否する。
- 旧版相当の古い無効化 Account と欠落 Profile を実 PostgreSQL 上に作成し、診断→解消→P4 切替/全鍵生成成功を回帰する。冪等性・rollback・移管・username 予約・旧鍵/旧連合データ保持も確認する。
- runbook の停止のみの境界を専用コマンドで解消→再診断→再実行へ更新する。手書き SQL の書込手順・本番操作は行わない。main 向け PR、Closes #issue、CI 緑、マージ禁止。

## Verification
実 PostgreSQL を必須にした CI job（ignored のみ不可）、診断 read-only/全所有履歴/無効化状態保持/再送冪等/競合/rollback/username reservation、既存 cutover 回帰、cargo fmt/clippy、git diff --check。

## Related Links
- host ADR intents/emumet/decisions/profile-federation-in-place-reset.md (p4-q02-recovery-unit-before-cutover)
- https://github.com/ShuttlePub/Emumet/pull/105

## Knowledge Maintenance
- Intent placement: profile-federation/overview.md（新 intent 不要）
- ADR candidate: 上記補足（host 所有）
- Diagram candidate: none
- Docs update: docs/profile-federation-cutover.md
- Closeout writeback expected: yes（host に PR/CI/実 DB 証拠、未マージ/本番未実施）

## Guide Reachability (G645)
intent-cli role-facing surface の追加なし。運用者向け command は Emumet runbook から到達。

## Base Branch Policy
Policy: `direct-main`
Expected PR base branch: `main`
