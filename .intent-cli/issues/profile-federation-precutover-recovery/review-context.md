# Review context

## 採用設計と根拠

前提: 全既存 Profile（射影行と全イベントの和集合）を対象とし、username 未設定が残れば切替拒否、切替後に鍵のない Profile を残さない。

採用: 選択肢 (3) の offline 管理経路。standalone driver binary が SQLx 接続を直接開き、AppModule/PostgresDatabase::new/migrate を呼ばず、既存 ProfileEventStore と Profile::apply で全履歴を読む。運用者が個別選択した username を旧版も理解する UsernameSet として append。行がなければ作らず、Account 状態・鍵・旧連合テーブルは不変。全既存対象・username 一回限り・一意性の不変条件を維持する。

比較: (1) 完全復元コマンドや (2) projector backport は再有効化/公開状態を変える経路と旧版専用 release の保守を増やす。本件は username 設定だけで切替拒否を解消でき、全履歴の読取りで旧 tailing-window バグを回避できるため不要。読み取り専用診断は併設する。

安全境界: 旧プロセス全停止/バックアップが前提。diagnose と set-username の既定 dry-run は read-only transaction。write 時は対象テーブルをロックし再検査、期待 Profile version を比較、username 形式と既存 reservation を検査。既存の username を変更/自動導出/除外しない。P4 migration 適用済み・不明な schema・復元不能履歴は fail closed。成功イベント/射影更新/専用監査行を一 transaction、request ID の同一引数再送は冪等 no-op、変更再送は拒否。operator/reason と対象/前後 version/username を保持。

専用監査表はコマンドの明示 write 時に非破壊 CREATE TABLE IF NOT EXISTS で導入（同 transaction）。新 migration を通常起動へ追加して P4 を誘発しない。失敗は非ゼロとエラー出力、運用者がコマンド出力も保管する。

非目標: Account 再有効化、projection 完全復元、projector backport、通常 API の権限変更、username の除外、P4 checksum 変更、汎用署名 API、本番 DB 操作、本番切替、PR マージ。

全既存 Profile の検査/鍵生成は #105 を維持。独立レビュー後にリードがマージを指示するまで未マージ。
