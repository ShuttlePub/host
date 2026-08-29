# profile-transfer Implementation Packet

## Goal

個人が持つ Profile を組織へ移管する 2段階フローを実装する。移管元
(個人) が申請し、移管先組織の Owner/Admin が承認して確定。承認時に
Profile の account_id を組織に付け替え (所有移転イベント)、参照ファイル
(icon/banner) のコピー要求を port に発行する。あわせて profiles.account_id
を部分ユニーク化 (personal のみ 1:1) し、組織の複数 Profile を可能にする。

設計の正源: intents/emumet/features/org-accounts/overview.md「確定設計」
(2026-08-29 grill Q6/Q7/Q9、interviews/org-accounts.json)。

## Why

org-accounts grill Q6 で「Profile 移管のみ」を product スコープに確定
(Account 変換は持たない)。acct/Actor URI・署名鍵・フォロー関係は
Profile スコープ (ADR 0002) を維持するため、移管は account_id の付け替え
で済み、将来互換性を保てる。org-accounts-foundation 完了後の後続 packet
( grill Q6 の決定通り、基盤 packet から分離 )。

## Scope

- ドメイン:
  - ProfileTransferRequest aggregate { id, profile_id, from_account_id,
    to_org_account_id, state, requested_by, created_at }
    + イベント (requested/accepted/rejected/cancelled)
    + テーブル (profile_transfer_requests。AccountReport と同型)
  - ProfileEvent::AccountTransferred { new_account_id } 新バリアント
    + Profile::apply の更新 (account_id 付け替え)
  - コピー port: 参照ファイル (icon/banner) のコピー要求
    (kernel 側インターフェース定義。実装は stub/no-op)
- migration:
  - profile_transfer_requests テーブル新設
  - profiles.account_id UNIQUE 撤廃 → 部分ユニーク
    (CREATE UNIQUE INDEX ... WHERE account_id IN (SELECT id FROM accounts
    WHERE kind = 'personal') 相当。個人 1:1 は維持)
- use case:
  - RequestTransferUseCase: 移管元 (Profile 所有者) が移管先 org を指定して
    申請。移管先は自分がメンバーの組織のみ
  - AcceptTransferUseCase / RejectTransferUseCase: 移管先 org の
    Owner/Admin (個人 identity + OrgRole 判定) が承認・却下
  - CancelTransferUseCase: 移管元が承認前に取消
  - 承認の処理: Profile account_id 付け替え (所有移転イベント) +
    コピー port 呼び出し (icon/banner がある場合)
- ルート (仮): POST /api/v1/profiles/{profile_id}/transfer、
  POST /api/v1/transfer-requests/{id}/accept|reject、
  POST /api/v1/transfer-requests/{id}/cancel
  facade: ProfileTransferApi 新設

## Out of scope

- 組織→個人の移管 (戻し。grill で将来検討)
- 移管先が個人 Account (組織のみ、grill Q6)
- ファイルコピーの実連携 (Booskiff 実装後の follow-up packet。
  本 packet は port + stub で完了とする)
- AP Announce (フォロワーへの移管通知)
- 移管の取引処理 (戻し経路)

## Verification

- ユースケース単体テスト: 申請→承認 (account_id 付け替え + イベント +
  コピー port 呼出し確認)・却下・取消・受理後取消 (422)・重複申請 (422)・
  非所有者の申請 (403)・非メンバー org への申請 (403)・非 Owner/Admin の
  承認 (403)
- migration 適用・ロールバック (部分ユニークの有効性: personal 重複
  拒否・organization 重複許可の両方を検証)
- 既存テスト全緑 (個人経路の 1:1 制約は維持される)
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/emumet/features/org-accounts/overview.md (primary) +
  packets.md unit 3
- ADR candidate: intents/emumet/decisions/0007-organization-accounts.md 追記 —
  AccountTransferred イベント + 部分ユニーク + コピー port
- Diagram candidate: none
- Docs update: none (移管フローの UI 要件は Ratcap C1 に引き継ぎ済み)
- Closeout learning: 部分ユニーク migration 定義 + コピー port 確定シグネチャ
  → write_back_required: true

- Guide reachability (G645): REST API (移管エンドポイント) を
  implementation-loop / implementation ロールとして追加 (packet.yaml 参照)。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
