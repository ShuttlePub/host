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

## 確定設計 (2026-08-29 grill で確定、Q1-Q11)

1. **対象ユースケース**: 組織としての公式アカウント運用 (企業・団体・
   コミュニティ)。個人 Profile の複数人共同運用は Non-goal
2. **実現パターン**: 組織 Account モデル。Account に個人/組織の種別を設け、
   組織 Account は複数の個人 Account をメンバーとして持つ。
   Profile : Account = N:1 を維持 (Booskiff の「所有者 = Account」への影響なし)。
   リモート Emumet アカウントのメンバー加入は将来フェーズ
   (Emumet 鯖間連携 feature として独立設計)
3. **メンバーロール (3段階)**: オーナー (所有・解散・オーナー移譲) /
   管理者 (メンバー管理・Profile 操作) / メンバー (Profile 操作のみ)。
   GitHub 的な責任者と運用者の分離
4. **認証**: スイッチ式。組織は Kratos identity を持たず、個人がログイン後に
   操作コンテキストを個人/所属組織に切り替える。課金主体 (組織) と操作者
   (個人メンバー) の分離と一致
5. **作成資格**: 認証済み個人なら誰でも作成可能、1人が複数組織を作成可。
   作成者が最初のオーナー。課金は作成ではなく容量・共有機能に対して課す
6. **Profile 移管**: 個人が持つ Profile を組織へ移管する機能を product スコープに
   含める。Account 変換は持たない。将来互換性: acct/Actor URI・署名鍵・
   フォロー関係は Profile スコープ (ADR 0002) を維持し、
   Profile の account_id 付け替えを恒久的禁止する制約を導入しない
7. **移管フロー**: 2段階 (移管元オーナーが申請 → 移管先組織のオーナー/管理者が
   承認)。状態: pending → accepted/rejected/cancelled。
   承認前は移管元が取り消し可、承認後は不可 (移管先による戻しは将来検討)
8. **組織 Drive (Booskiff)**: 組織専用 Drive。組織 Account 所有の独立 Driveで、
   メンバーの個人 Drive とは完全分離。課金・容量は組織単位
   (詳細は Booskiff ドメイン側で設計)
9. **移管時の参照ファイル**: 移管時に参照ファイル (アイコン等) を組織 Drive へ
   コピーし、Profile の参照を付け替える。元ファイルは個人 Drive に残る。
   Booskiff 要件: copy 系 API。UI 要件: 移管フローでコピー対象と挙動を明示
10. **モデレーション**: 現行 Account 単位モデルにそのまま乗せる
    (通報・Suspend・Ban は AccountId 対象、多態化しない)。
    組織への ban は全組織 Profile を停止、メンバー個人には影響しない。
    あわせて `AccountEvent::Warning` (警告) を新設し、通報 resolve 時に
    「警告で解決」を選択可能にする。警告履歴はイベントとして残す
11. **Ratcap への波及**: Emumet 側は API 契約のみ確定し、UI 設計は
    Ratcap ドメインの grill に引き継ぐ。
    波及: (1) 組織コンテキスト切替 UI (2) 移管フロー UI
    (3) モデレーション UI (警告選択肢・組織区別表示) (4) 組織 Drive UI

## Scope (確定)

- 組織 Account の作成 (認証済み個人が作成、作成者が最初のオーナー)
- メンバー管理 (招待・3段階ロール: オーナー/管理者/メンバー)
- 組織コンテキスト切替 (個人 identity でログイン → 組織に切替)
- 組織 Profile の運用 (メンバーによる作成・更新)
- Profile 移管 (個人→組織、2段階フロー、移管時の参照ファイルコピー)
- AccountEvent::Warning 新設 (通報 resolve 時の「警告で解決」)
- 組織の解散 = 既存 Account 削除フローに準ずる (Tombstone / AP Delete 配信)

## 将来検討 (確定ではない)

- リモート Emumet アカウントのメンバー加入 (Emumet 鯖間連携)
- Profile 単位の個別停止 (現行は Account 単位のみ)
- 移管の取り消し (移管先による戻し)
- 不在オーナーの自動処理 (初期はオーナー移譲で対処)

## Related

- [ADR 0002](../decisions/0002-account-address-on-emumet-domain.md) (Account/Profile の定義)
- [account-management](account-management/overview.md)
- [interview 2026-08-29 grill](../../interview/2026-08-29-org-accounts-grill.md) (Q1-Q11 の決定経緯)
- Booskiff clarifications C1 (host リポ intents/booskiff、発見経緯)
- Ratcap clarifications C1 (host リポ intents/ratcap、波及リスト)
