# moderation-warning-event Implementation Packet

## Goal

`AccountEvent::Warned` (警告) を新設し、通報 (AccountReport) の resolve 時に
「警告で解決」 (warned resolution) を選択可能にする。警告は Account の状態を
変えない処分履歴 (イベント) として残し、繰り返し違反の判断材料にする。
Admin/Moderator がアカウントの警告履歴を参照できる read query/API を提供する。

設計の正源: org-accounts grill Q10 (2026-08-29、interviews/org-accounts.json)
— 「現行 Account 単位モデレーションに乗せる + Warning イベント新設」。

## Why

org-accounts grill Q10 の決定の実装。組織 (将来は個人も) への段階的対処の
手段として警告を導入し、組織全体の即時停止 (Suspend/Ban) を避ける。
moderation-account-report (issue #53/PR #54 完了) の resolution 体系の拡張で、
新規 aggregate は不要な小さなスライス。

## Scope

- ドメイン (kernel/src/entity/account.rs):
  - AccountEvent::Warned { reason, warned_at } 追加
    (serde: tag "type"、snake_case "warned"。apply() は status を変えない
    — イベント記録のみ)
  - Account::warn コマンドメソッド追加 (reason バリデーションは
    ModerationReason 既存パターンに倣う)
- 通報 (kernel/src/entity/account_report.rs):
  - ReportResolution::{Resolved, Dismissed} → Warned 追加
  - resolve 時に resolution を選択可能に (close_reason 必須は維持)
- use case (application/src/service/):
  - WarnAccountUseCase: instance_moderate 認可 → Account warn イベント保存
  - ResolveReportUseCase の拡張: resolution に warned を許可
- read query: AccountReadModel に warned イベント一覧クエリ追加
  (account_events を event_name='warned' + account_id フィルタ。新テーブル不要)
- ルート (仮):
  - POST /api/v1/admin/accounts/{account_id}/warn (warn 発行)
  - 通報 resolve エンドポイントの resolution 対応 (既存パス後方互換)
  - GET /api/v1/admin/accounts/{account_id}/warnings (警告履歴)
  - facade: AdminAccountApi 拡張 (既存 facade にメソッド追加)

## Out of scope

- 自動エスカレーション (N 回警告で Suspend/Ban) — 将来論点
- 警告を受けたユーザーへの通知 — 通知 feature は未設計
- AP 連合への警告送信 — ローカルのみ
- AccountStatus への Warning 状態の追加 (grill Q10: 状態は変えない確定)
- org-accounts 自体の実装 (org-accounts-foundation 等の packet)

## Verification

- ユースケース単体テスト: warn 発行 (権限あり/なし)・通報 warned 解決
  (close_reason 必須・二重クローズ拒否)・既存 resolved/dismissed の回帰なし・
  警告履歴クエリ
- イベントの serde 後方互換 (既存 account_events のデシリアライズ回帰)
- 既存テスト全緑、`git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: features/moderation/overview.md (primary) +
  decisions.md D4 へ warned resolution 追記、packets.md へ unit 追記
- ADR candidate: none (D4 の追記で十分な粒度)
- Diagram candidate: none
- Docs update: none
- Closeout learning: resolution 拡張の実装形状確定値 → write_back_required: true

- Guide reachability (G645): REST API (warn/warnings エンドポイント) を
  implementation-loop / implementation ロールとして追加 (packet.yaml 参照)。

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
