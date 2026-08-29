# Open Clarifications

## C1 (解消済み 2026-08-29): Profile の Account 共有 / 組織アカウント

- 結論: emumet C5 (org-accounts) が grill で確定。**「所有者 = Account」は
  組織 Account も含めて確定**。Profile : Account = N:1 が維持され、
  共有 Profile が複数 Account の Drive を跨ぐ問題は発生しない
- 確定内容 (emumet grill Q1-Q11 より Booskiff 関連):
  - 組織 Drive は組織 Account 所有の専用 Drive (課金・容量は組織単位)
  - Profile 移管時は参照ファイルを組織 Drive へコピー + 参照付け替え
  - Booskiff 要件: (1) Drive の所有者として組織 Account を許可
    (2) copy 系 API (移管時のファイルコピー用)
- 決定記録: intents/emumet の features/org-accounts/overview.md、
  interview/2026-08-29-org-accounts-grill.md
- Booskiff 側の課金・容量の詳細設計は本ドメインの grill/stack で計画する
