# org-accounts — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

1. `org-accounts-foundation` — 組織 Account 基盤: Account 種別
   (personal/organization) + 組織作成 + メンバーシップ (3段階ロール) 管理 API
   (packet: `.intent-cli/issues/org-accounts-foundation/`) — depends on: —。
   実装: Emumet [issue #55](https://github.com/ShuttlePub/Emumet/issues/55) /
   [PR #56](https://github.com/ShuttlePub/Emumet/pull/56)
   (2026-09-01 squash merge `d01d424`)。設計 write-back:
   [ADR 0007](../../decisions/0007-organization-accounts.md)
2. `org-accounts-auth-context` — スイッチ式認証: 個人 identity のまま
   組織コンテキストを指定して操作する認証・認可 (ヘッダ/claim 方式、
   メンバーロール判定 + コンテキスト付き AccountId 解決、組織コンテキストでの
   Profile 操作) (packet: `.intent-cli/issues/org-accounts-auth-context/`) —
   depends on: org-accounts-foundation。 実装: Emumet
   [issue #57](https://github.com/ShuttlePub/Emumet/issues/57) /
   [PR #58](https://github.com/ShuttlePub/Emumet/pull/58)
   (2026-09-02 squash merge `c33fe53`)。設計 write-back:
   [ADR 0007](../../decisions/0007-organization-accounts.md) 決定6
3. `profile-transfer` — Profile 移管: 個人→組織の 2段階フロー
   (申請→承認、参照ファイルのコピー要求 port、所有移転イベント)
   (packet: `.intent-cli/issues/profile-transfer/`) — depends on: org-accounts-foundation
   (認証コンテキストは必須ではない — 承認は個人 identity + メンバーロール判定)。
   実装: Emumet [issue #61](https://github.com/ShuttlePub/Emumet/issues/61) /
   [PR #62](https://github.com/ShuttlePub/Emumet/pull/62)
   (2026-09-04 squash merge `a34f524`)。設計 write-back:
   [ADR 0007](../../decisions/0007-organization-accounts.md) 決定7
4. `moderation-warning-event` — AccountEvent::Warning 新設 + 通報 resolve 時の
   「警告で解決」 (packet: `.intent-cli/issues/moderation-warning-event/`) —
   depends on: — (moderation-account-report 完了済み)

設計の正源: [overview.md](overview.md)「確定設計」、
[../interview/2026-08-29-org-accounts-grill.md](../../interview/2026-08-29-org-accounts-grill.md) (Q1-Q11)。

## 未パケット化の残スコープ

- リモート Emumet アカウントのメンバー加入 — 将来フェーズ (Emumet 鯖間連携 feature)
- 移管の戻し (組織→個人) — 将来検討
- 組織 Profile の AP 上の区別 (Organization actor 型など) — 現行は Person のまま維持
- 組織の課金 — 将来フェーズ
