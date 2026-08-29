# Open Clarifications

## C1 (open): Profile の Account 共有 / 組織アカウントは Emumet 現行未想定

- 背景: Booskiff のファイル所有者は Emumet Account 単位としたい
  (mission.md Values 参照)。ただし「複数の Account が 1 Profile を共同運用する」
  ケース (企業アカウント等) が Emumet で想定されているか不明だった
- 2026-08-29 調査で判明: **現行は 1 Profile : 1 Account のみ共有なし**。
  - intent 側: ADR 0002 (amended 2026-08-24) — Profile は Account に所属する actor、
    共同管理の言及なし
  - 実装側: `kernel/src/entity/profile.rs` の `account_id` は単数、
    `profiles` テーブルは `account_id` 単一カラム + `REFERENCES accounts(id)`
    (N:M 中間テーブルなし)
- 論点:
  - Booskiff は当面「所有者 = 1 Account」を invariant としてよい (現行 Emumet と整合)
  - 将来 Emumet に組織アカウント / Profile 共同管理が入った場合、Booskiff の
    所有者解決・Drive 課金紐付けの再検討が必要になる
  - 「1 Account が複数 Profile を持つ」方向 (現行サポート) と
    「複数 Account が 1 Profile を共有」方向 (未想定) は別物。後者が入ると
    共有 Profile がどの Account の Drive を使うか等の問題が発生する
- **再開条件: Emumet 側で組織アカウント・共同管理の構想が出た時点で再検討する**
