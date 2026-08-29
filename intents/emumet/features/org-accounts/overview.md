---
facets: [vocabulary, invariant]
---

# org-accounts — overview

## Goals

複数の個人 Account (メンバー) が 1 つの組織 Account を共同運用し、その
組織 Account の下で Profile (AP actor) を管理できるようにする。

## 背景・動機

- 2026-08-29、Booskiff (ドライブストレージサービス) の設計議論で炙り出された
  構想ギャップ。「複数人が 1 Profile を共同運用する」ケース (企業アカウント等)
  が Emumet の現行設計・実装で想定されていないことが判明
  (Profile : Account = N:1 のみ、中間テーブルなし。
  ADR 0002 / `profiles.account_id` 単一 FK で確認済み)
- operator 判断: 「将来かも」ではなく**すぐやりたい要件**
- ADR 0002 の「Account = Workspace 的管理主体 (ログイン・課金・Profile 管理)」の
  定義を拡張する自然な方向性

## 検討パターン

1. **組織 Account モデル (推奨)**: Account に個人/組織の種別を設け、
   組織 Account は複数の個人 Account をメンバーとして持つ。Profile は
   組織 Account に所属させる。Profile : Account = N:1 は維持され、
   Booskiff の「所有者 = Account」モデルにも影響しない。
   課金主体は組織 Account (Google Workspace 的)
2. **Profile 共同編集者 (N:M)**: 個人 Profile に複数 Account を紐付ける。
   柔軟だが、所有関係が曖昧になり (例: Booskiff の Drive 所有者解決)、
   課金の抜け道 (複数 Profile で容量分散等) も生まれやすい

## Scope (案)

- 組織 Account の作成・メンバー管理 (招待・役割)
- 組織 Profile の運用 (メンバーによる切り替え操作)
- 課金主体の明確化 (Booskiff 連携前提)

## Related

- [ADR 0002](../decisions/0002-account-address-on-emumet-domain.md) (Account/Profile の定義)
- [account-management](account-management/overview.md)
- Booskiff clarifications C1 (host リポ intents/booskiff、本 feature の発見経緯)
