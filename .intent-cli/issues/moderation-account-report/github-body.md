# moderation-account-report: 通報(AccountReport)機能 — 作成 API + モデレーターハンドリング API (ES aggregate、3状態)

## Goal

認証済みローカルユーザーがローカルアカウントを通報する client API
(`POST /api/v1/reports`) と、Admin/Moderator が通報を一覧・状態遷移
(resolve/dismiss) する admin API (`GET /api/v1/admin/reports`、
`POST /api/v1/admin/reports/{id}/resolve|dismiss`) を新設する。
永続化は ADR 0006 パターンの ES aggregate (AccountReport) + tailing
projector + read projection とする。

## Why This Slice Exists Now

moderation feature の残スコープの中核。依存していた
moderation-role-assignment (issue #45 / PR #48) はマージ済みで、Keto
`moderate` permit (admins + moderators 包含) も既存。Ratcap 側の
admin-moderation (通報キュー UI + /admin 集約 + 件数バッジ) は本 API を
前提に設計確定しており、Emumet 先行の直列順序の先頭
(2026-08-23 横断 grill で確定、features/moderation/decisions.md D4)。

## Current Observed State

- 通報 (AccountReport) のコードは kernel / application / server の
  いずれにも存在しない
- Keto `moderate` permit は admins + moderators 包含済み
  (ory/keto/namespaces.ts)。認可基盤の変更不要
- ES 実装の型は Account / Profile / Metadata で確立済み
  (AggregateRepository + tailing projector + version-gated upsert)
- ロール割当 API は実装済み (PUT/DELETE /api/v1/admin/accounts/{id}/roles/{role})

## Accepted Baseline You May Assume

- 通報対象はローカルアカウントのみ (リモート通報・AP Flag 連合は
  ホストモデレーション feature の将来スコープ)
- 状態は open / resolved / dismissed の3状態 + close_reason 必須。
  通報は作成後 immutable (updated イベントなし)
- カテゴリは列挙 (spam / harassment / other)。other 時のみ comment 必須
- ハンドリング認可は instance_moderate (Admin + Moderator) を流用
- 通報作成は認証済みユーザー全員。重複通報は許可 (別レコード)。
  通報者本人向け一覧は初期スコープ外
- エラーマッピングは既存共有 ErrorStatus マッピングに従う
  (Rejected → 422、packet 間の一貫性)

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/prelude/entity, kernel/src/interfaces/repository, application/src/service, application/src/projection, server/src/route, server/src/api, driver/src/database/postgres, migrations`

Target part: AccountReport aggregate + イベント + tailing projector +
read projection + 通報作成 client API + ハンドリング admin API

## Acceptance Criteria

- 認証済みユーザーが POST /api/v1/reports (仮パス) でローカルアカウントへの
  通報を作成できる (target nanoid + category + comment。other 時は comment 必須)
- リモートアカウント・存在しないアカウントへの通報は 404、不正 category は 400
- instance_moderate 保持者が GET /api/v1/admin/reports で一覧取得できる
  (open フィルタ + 未対応件数 count を含む)。権限なしは 403
- instance_moderate 保持者が resolve / dismiss を close_reason 必須で実行できる。
  既 closed への再遷移は Rejected (422)
- 作成・状態遷移が account_report_created / account_report_closed
  (resolution 分類 + close_reason) イベントとして保存され、tailing projector が
  read projection を冪等に更新する
- 同一 reporter → 同一 target の重複通報は別レコードとして許可される
- ユースケース単体テストで作成・権限拒否・二重クローズ拒否・
  other 時 comment 必須が検証される

## Out of Scope

- リモートアカウントの通報・AP Flag 連合 (送信/受信)
- 投稿 (Note) 単位の通報
- 通報者本人向けの一覧・状態開示 API、rate limit、担当者アサイン
- 通報と suspend/ban の自動連動
- Ratcap 側 UI — Ratcap `admin-moderation` packet (本 packet マージ後に publish)

## References

- Design decisions: `intents/emumet/features/moderation/decisions.md` D4
- Grill record: `intents/emumet/interview/2026-08-23-moderation-account-report-grill.md`
  (CLI session: `intents/emumet/interviews/moderation-account-report.json` Q1-Q10)
- Feature: `intents/emumet/features/moderation/` (overview / requirements / packets)
