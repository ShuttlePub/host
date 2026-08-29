# Open Clarifications

## C1 (open): emumet org-accounts からの UI 波及

- 背景: emumet C5 の grill (2026-08-29) で組織 Account 機能の設計が確定した。
  Emumet 側は API 契約のみ確定し、UI 設計は本ドメイン (Ratcap) で詰める
  (emumet grill Q11 の決定)
- 波及リスト:
  1. **組織コンテキスト切替 UI** — スイッチ式認証 (個人でログイン → 組織に
     切替) のため、「個人として操作中 / 組織として操作中」の状態表示と
     切替導線が必要
  2. **移管フロー UI** — Profile 移管の申請 (個人側) と承認 (組織側) の画面、
     移管時の参照ファイルコピー対象と挙動の明示 (emumet Q9)
  3. **モデレーション UI** — 通報 resolve 時の「警告で解決」選択肢の追加
     (emumet Q10: AccountEvent::Warning 新設)、組織アカウントの区別表示
  4. **組織 Drive (Booskiff) UI** — 組織コンテキストでの Drive 操作
- 前提となる Emumet 側の確定事項:
  - features/org-accounts/overview.md の「確定設計」
  - interview/2026-08-29-org-accounts-grill.md (Q1-Q11)
- **再開条件: Ratcap 側で組織 Account 関連 UI の実装着手時に grill で詰める。
  API 契約の具体形が必要になった時点で emumet 側に確定を求める**
