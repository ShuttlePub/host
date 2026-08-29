# org-accounts — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) C5 for domain-level context.
> 全論点は **2026-08-29 の grill (Q1-Q11) で解消**。
> 決定の詳細は [overview.md](overview.md) の「確定設計」と
> [interview/2026-08-29-org-accounts-grill.md](../../interview/2026-08-29-org-accounts-grill.md) を参照。

## Open questions blocking this feature

- なし (2026-08-29 grill で全て解消。packet 分割と実装詳細は stack で計画)

## Resolved (2026-08-29 grill)

- ~~実現パターンの確定~~ → **組織 Account モデル** (Q1/Q2)。
  個人 Profile 共同運用は Non-goal、リモートメンバーは将来フェーズ
- ~~メンバー役割~~ → **3段階** (Q3): オーナー/管理者/メンバー
- ~~ログイン・認証~~ → **スイッチ式** (Q4): 組織は Kratos identity を持たない
- ~~組織 Account の作成資格~~ → **誰でも・複数作成可** (Q5)
- ~~個人 Account の組織化~~ → **Profile 移管のみ** (Q6)。Account 変換は持たない。
  acct/鍵/フォロワーは Profile スコープ維持で将来実装可能に保つ
- ~~Profile 移管のフロー~~ → **2段階フロー** (Q7): 申請→承認
- ~~組織 Drive (Booskiff)~~ → **組織専用 Drive** (Q8)。
  課金・容量の詳細は Booskiff ドメインに委譲
- ~~移管時の参照ファイル~~ → **組織 Drive へコピー + 参照付け替え** (Q9)。
  UI で明示。Booskiff 要件: copy API
- ~~モデレーション整合~~ → **現行 Account 単位モデル + Warning イベント新設**
  (Q10): 組織 ban は全組織 Profile 停止、警告で解決を選択可能に
- ~~Ratcap への波及~~ → **Emumet は API 契約のみ確定、UI 設計は Ratcap grill へ**
  (Q11): コンテキスト切替 UI・移管 UI・モデレーション UI・組織 Drive UI
