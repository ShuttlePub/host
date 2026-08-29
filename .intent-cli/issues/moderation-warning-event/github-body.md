# moderation-warning-event: AccountEvent::Warning 新設 + 通報「警告で解決」+ 警告履歴参照

## Goal

アカウントへの「警告」処分を導入する。AccountEvent::Warned を新設し、
通報 (AccountReport) の resolve 時に「警告で解決」 (warned) を選択可能にする。
警告はアカウントの状態 (Active 等) を変えず、イベントとして履歴に残す。
Admin/Moderator が警告履歴を参照できる API を提供する。

## Why This Slice Exists Now

org-accounts grill Q10 (2026-08-29) の決定の実装。組織アカウントへの段階的
対処 (警告 → Suspend → Ban のエスカレーション経路) を可能にし、組織全体の
即時停止を避ける。通報機能 (moderation-account-report、issue #53/PR #54 完了)
の resolution 体系拡張であり、新規 aggregate は不要。

## Current Observed State

- AccountEvent: Created/Updated/Deactivated/Suspended/Unsuspended/Banned/
  Unbanned/Reactivated。警告バリアントなし (kernel/src/entity/account.rs)
- AccountStatus: Active/Suspended/Banned。Warning 状態なし
- ReportResolution: Resolved/Dismissed。Warned なし
  (kernel/src/entity/account_report.rs)
- 通報 resolve/dismiss: close_reason 必須、二重クローズは 422
  (POST /api/v1/admin/reports/{id}/resolve|dismiss)

## Accepted Baseline You May Assume

- 警告はアカウントの状態を変えない (Active のまま)。処分履歴としてイベント
  に残すのみ (grill Q10)。AccountStatus / CHECK 制約は変更不要
- ハンドリング認可は instance_moderate (Admin + Moderator、変更不要)
- 組織への警告も同一イベントで扱う (AccountId 対象・多態化しない。
  org-accounts の kind 追加後も Warned 発行に制限を設けない)
- 既存の resolved/dismissed 経路は後方互換維持
- 自動エスカレーション・ユーザー通知・連合送信はスコープ外

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/entity, kernel/src/read_model, application/src/service, server/src/route, server/src/api, driver/src/database/postgres`

Target part: AccountEvent::Warned バリアント + ReportResolution::Warned + warn use case + 警告履歴 read query/API

## In Scope

- AccountEvent::Warned { reason, warned_at } + Account::warn メソッド
- ReportResolution::Warned + resolve 時の選択対応
- WarnAccountUseCase + 警告履歴 read query
- REST API: warn 発行、通報 resolve の warned 対応、警告履歴取得

## Out Of Scope

- 自動エスカレーション、ユーザー通知、AP 連合送信
- AccountStatus への Warning 状態追加
- org-accounts の組織機能自体

## Standalone Child Issue Contract

この PR は、Emumet のモデレーションに「警告」処分を追加するものである:
Admin/Moderator がアカウント (個人・組織の区別なし) に警告を発行でき、
通報を「警告で解決」でクローズできる。警告はアカウントの状態を変えず、
イベント履歴として残る。警告履歴は admin API で参照できる。

## Acceptance Criteria

- AccountEvent::Warned { reason, warned_at } が追加され、serde 規約に従い
  account_events に event_name='warned' で保存される
- Warned 発行で Account の status は変わらない
- ReportResolution::Warned が追加され、通報 resolve 時に選択できる
  (close_reason 必須維持、ReportProjection に warned が記録される)
- 既存 resolved/dismissed 経路は後方互換 (既存テスト全緑)
- instance_moderate 権限でのみ warn 発行可 (権限なし 403)
- admin が警告履歴 (reason, warned_at 一覧) を参照できる
- ユースケース単体テストで上記が検証される

## Verification

- ユースケース単体テスト (warn 発行・通報 warned 解決・権限拒否・二重クローズ拒否)
- イベント serde 後方互換確認
- 既存テスト全緑、`git diff --check`

## Related Links

- 設計: host リポ `intents/emumet/interview/2026-08-29-org-accounts-grill.md` (Q10)、
  `intents/emumet/features/moderation/decisions.md` (D4 通報設計)
- 前提 (完了): moderation-account-report (issue #53 / PR #54)
- 関連: org-accounts (本警告は組織の段階的対処としても使用)

## Knowledge Maintenance

- Intent placement: features/moderation/overview.md、decisions.md D4 追記、
  packets.md unit 追記
- ADR candidate: none
- Diagram candidate: none
- Docs update: none
- Closeout writeback expected: yes (D4 + packets.md)

## Guide Reachability (G645)

role-facing surface: REST API (warn/warnings、通報 resolve の warned)。
guide surface: implementation-loop、role: implementation。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
