# moderation-account-report Implementation Packet

## Goal

通報 (AccountReport) 機能を実装する。認証済みローカルユーザーがローカル
アカウントを通報する client API と、Admin/Moderator が通報を一覧・状態遷移
(resolve/dismiss) する admin API を新設する。永続化は ADR 0006 パターンの
ES aggregate (AccountReport) + tailing projector + read projection とする。

設計の正源は features/moderation/decisions.md D4 (2026-08-23 横断 grill、
interviews/moderation-account-report.json Q1-Q10)。

## Why

moderation feature の残スコープの中核 (features/moderation/packets.md unit 2)。
依存していた moderation-role-assignment (issue #45 / PR #48) はマージ済みで、
Admin/Moderator の操作主体と Keto `moderate` permit (admins + moderators 包含) が
揃っている。Ratcap 側の admin-moderation (通報キュー UI) は本 API を前提に
設計確定しており、Emumet 先行の直列順序の先頭。

## Scope

- ドメイン: `AccountReport` aggregate + イベント
  - `account_report_created` { target (AccountId), reported_by (AccountId),
    category, comment? }、 `account_report_closed` { resolution
    (resolved | dismissed), close_reason }
  - 状態は open / resolved / dismissed。作成後 immutable
    (updated イベントは作らない)
  - category は列挙 (spam / harassment / other)。other 時は comment 必須、
    それ以外は任意
- イベントテーブル + projection テーブルの migration
  (account_events 系の既存命名・seq 列・projection_checkpoints に倣う)
- `AggregateRepository<AccountReport>` の登録と Postgres 実装
  (既存パターン踏襲。必要なら generic 実装の型登録のみ)
- tailing projector: `application::projection::ReportProjector` (仮) 新設、
  read projection DTO (ReportProjection) への version-gated upsert
- use case (`application/src/service/report/` 仮):
  - CreateReportUseCase: 認証ユーザーの所有 Account 解決 → target の
    ローカルアカウント存在確認 (find_by_nanoid_unfiltered) →
    カテゴリ/comment バリデーション → UoW で created イベント保存。
    重複通報は許可 (別レコード)
  - ListReportsUseCase: instance_moderate 認可 → open フィルタ +
    未対応件数 count を含む一覧を read projection から返す
  - ResolveReportUseCase / DismissReportUseCase: instance_moderate 認可 →
    close_reason 必須 → 既 closed は Rejected → UoW で closed イベント保存
- ルート:
  - client: `POST /api/v1/reports` (仮パス、utoipa 注釈付き)
  - admin: `GET /api/v1/admin/reports`、
    `POST /api/v1/admin/reports/{id}/resolve` / `.../dismiss`
  - facade は既存パターンに倣う (AdminAccountApi 相当の薄い層)
  - エラーマッピングは既存共有 ErrorStatus マッピングに従う
    (PermissionDenied → 403、NotFound → 404、Rejected → 422、不正入力 → 400)

## Out of scope

- リモートアカウントの通報・AP Flag 連合 (送信/受信) — 将来の
  ホストモデレーション feature で別途設計 (D4)
- 投稿 (Note) 単位の通報 — 将来別 feature
- 通報者本人向けの一覧・状態開示 API — 将来論点 (通知設計とセット)
- 通報の rate limit — 連打が問題になった時点で別途対処
- 担当者アサイン (assigned) 機能
- Ratcap 側 UI (通報フォーム / /admin/reports キュー / 件数バッジ) —
  Ratcap `admin-moderation` packet のスコープ (本 packet マージ後に publish)
- 通報と suspend/ban の自動連動 (自動クローズ等) — モデレーターが手動で行う

## Verification

- use case 単体テスト (mock PermissionChecker / repo):
  作成正常系、other 時 comment 必須違反、非モデレーターの一覧/遷移で
  PermissionDenied、既 closed への再遷移で Rejected、未存在 target で NotFound
- projector の統合テスト: created → projection 反映、closed → 状態更新、
  重複適用の冪等性 (version-gated upsert)
- REST 結合: 作成 → admin 一覧に open で出現・count 増加 → resolve で
  resolved に遷移・close_reason 保存 → 一覧の open フィルタから消失
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/emumet/features/moderation/overview.md (新規ノード不要)
- ADR candidate: なし (設計判断は features/moderation/decisions.md D4 に記録済み)
- Diagram candidate: なし
- Docs update: なし (document リポジトリ data-structure.md の AccountReport
  記載同期は Host-only backlog 項目)
- Closeout learning: イベント/projection テーブル最終命名・一覧 API の
  フィルタ/ページネーション最終シグネチャ (write_back_required: false)

- Guide reachability (G645): packet.yaml の guide_reachability を参照
  (implementation-loop → 通報作成 client API + ハンドリング admin API)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
