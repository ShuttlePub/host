# Review context

最新 Emumet origin/main 8b6ceb4 で静的確認: 無効化で profiles が削除され、P4 の username 検査と PostgresProfileSigningKeyRepository::find_profiles_without_active_key は FROM profiles のみ。Account projector の restore_owned_profiles は全履歴を復元するが鍵を生成しない。P4 #91 (daeb625) / P1 #78 の鍵必須判定により、切替前無効化 Profile が取りこぼされる。

## Must verify

- 無効化 Profile が username 設定済みなら、無効化状態を保ったまま切替時に鍵を生成し、再起動せず再有効化後 actor 200 と publicKey を確認できる。
- 無効化 Profile の username が未設定なら P4 前に拒否し、旧連合データ・台帳・migration 状態に破壊的変更がない。復旧して再試行できる。
- 既存鍵の再生成・上書き、旧鍵の変換、新しい署名 REST API、暗黙の Account 再有効化をしない。
- 実 PostgreSQL テスト (DATABASE_URL 必須、skip のみ不可) と既存回帰、fmt/clippy、CI が成功する。PR は main 向け、Closes #issue を含み、マージしない。
- Created の username と後続 UsernameSet の両方、無効化後も保持される履歴、移管後の同じ id/nanoid、既存鍵、ページングを考慮。
- 既存 P4 migration checksum を変更しない。追加検査は破壊的 migration より前。P4 済み DB を壊さない。
- DB テストは DATABASE_URL 付きで本当に動かす。skip は合格証拠でない。
- 本番切替・マージ禁止。独立レビューは別途リードが判断。

## Knowledge Writeback Expectation

runbook を更新。host の ADR/PF acceptance はレビュー後 closeout で追記し、未マージの実装を確定扱いしない。
