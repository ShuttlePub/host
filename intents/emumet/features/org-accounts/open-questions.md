# org-accounts — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) C5 for domain-level context.

## Open questions blocking this feature

- **実現パターンの確定**: 組織 Account モデル vs Profile 共同編集者 (N:M)。
  overview の検討パターン参照。**推奨は組織 Account モデル** (2026-08-29 時点) だが
  operator 確定はまだ
- **メンバー役割**: オーナー/管理者/メンバーの階層は必要か。役割ごとの
  操作可能範囲 (Profile 作成・削除・署名・課金管理)
- **ログイン・認証**: 組織 Account 自体は Ory Kratos identity を持たない想定か
  (メンバーが個人 identity でログイン → 組織にスイッチ、GitHub 的)。
  Hydra consent scope はどう設計するか
- **組織 Account の作成者**: 誰でも作れる? 個人 Account 保有が前提か
- **既存 Account の組織化**: 個人 Account を組織に変換する経路は必要か
- **Booskiff との整合**: 組織 Account が Drive を持つ場合の課金・容量設計
- **モデレーションとの整合**: 組織 Profile の通報・ban は誰に効くか

## Resolved

- (なし)
