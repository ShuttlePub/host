# account-unban-reactivate: unban (Banned→Active) admin API + reactivate (deactivated 復帰) API

## Goal

モデレーション操作の未実装ペアを補完する。Admin/Moderator 向けの unban
(Banned → Active) admin REST API と、owner 向けの reactivate (deactivated 復帰)
client REST API を新設し、kernel の AccountEvent に Unbanned / Reactivated を
追加する。既存の UoW + Event Sourcing パターン (ADR 0006 Stage 4 確立) に倣う。

## Why This Slice Exists Now

ADR 0006 Stage 4 (account-write-usecases) で suspend/unsuspend/ban/deactivate は
UoW 化されたが、unban / reactivate は未実装のまま残った。Ban の解除手段がないと
モデレーション運用が一方通行で誤 Ban を戻せず、deactivate も復帰不能なため
owner の自己削除が事実上の永久削除になっている。

## Current Observed State

- AccountEvent は Created/Updated/Deactivated/Suspended/Unsuspended/Banned のみ
  (kernel/src/entity/account.rs)。Unbanned / Reactivated は未定義
- admin ルートは suspend/unsuspend/ban のみ (server/src/route/account/admin.rs)
- deactivate は owner の client ルート (DELETE /api/v1/accounts/{account_id}) で、
  Keto Owner/Editor/Signer 関係を post-commit で削除する。復帰経路は存在しない
- find_by_auth_id は deleted_at IS NULL でフィルタされるため、deactivated
  アカウントの owner 紐付け確認には使えない

## Accepted Baseline You May Assume

- moderation usecase は UoW パターン: find_by_nanoid_unfiltered →
  check_permission(instance_moderate) → tx 内 load → 状態 guard → save
  (BanAccountUseCase、application/src/service/account/moderation.rs)
- 投影は tailing projector + read model update() に一本化済み (直接 Signal emit なし)。
  新イベントは EventApplier 経由で自動反映され、DB マイグレーション不要
- Keto subject は AuthAccountId。KetoClient PermissionWriter は冪等
  (再付与 409 / 未付与剥奪 404 を Ok 吸収)
- 認可・エラーマッピングは既存 admin ルートに倣う (PermissionDenied → 403、
  NotFound → 404、Rejected → 400)

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `kernel/src/entity/account.rs, application/src/service/account/moderation.rs, application/src/service/account, kernel/src/read_model/account.rs, driver/src/database/postgres/account/mod.rs, server/src/route/account/admin.rs, server/src/route/account/client.rs, server/src/api/admin_account.rs, server/src/schema/account.rs`

Target part: `AccountEvent::Unbanned/Reactivated 追加 + Unban/ReactivateAccountUseCase + admin/client REST ルート`

## In Scope

- kernel: AccountEvent に Unbanned / Reactivated 追加 + command constructor +
  EventApplier match arm (Unbanned: is_banned guard → Active、Reactivated:
  deleted_at guard → deleted_at = None。status は変更しない)
- application: UnbanAccountUseCase (instance_moderate 認可) /
  ReactivateAccountUseCase (auth_emumet_accounts 紐付けで owner 確認 →
  UoW → post-commit で Keto Owner/Editor/Signer 再付与)
- read model: 削除込みの紐付け確認 query (kernel facade + Postgres 実装)
- ルート: POST /api/v1/admin/accounts/{account_id}/unban、
  POST /api/v1/accounts/{account_id}/reactivate (utoipa 注釈付き)

## Out Of Scope

- 通報 (AccountReport) — Ratcap 横断設計の grill 待ち (別 unit)
- suspend 期限切れの自動 unsuspend、AP Delete 取り消し配送
- Banned/Suspended での deactivate 禁止ルール追加 (現行仕様維持)
- document リポジトリ同期 (Host-only backlog 項目)

## Standalone Child Issue Contract

Emumet に unban / reactivate API を追加する。kernel の AccountEvent に
`Unbanned` (Banned → Active、非 Banned は拒否) と `Reactivated` (deleted_at
クリア、非 deactivated は拒否、status は変更しない) を追加し、EventApplier で
状態 guard つきの適用を実装する。unban は `POST /api/v1/admin/accounts/{account_id}/unban`
として instance moderate permit (admins/moderators) で認可する admin API、
reactivate は `POST /api/v1/accounts/{account_id}/reactivate` として
auth_emumet_accounts の紐付け (削除込みで確認する query を新設) で owner を
検証する client API とし、完了時に Keto の Owner/Editor/Signer 関係を再付与する。
いずれも ADR 0006 Stage 4 の UoW パターン (tx 内 load → guard → save) に倣い、
投影は既存の tailing projector に委ねる。

## Acceptance Criteria

- Admin/Moderator が unban で Banned アカウントを Active に戻せる
  (非 Banned / deactivated は 400、未存在は 404、非モデレーターは 403)
- unban 後、GET /api/v1/accounts/{id} の moderation が null になる
- owner が reactivate で deactivated アカウントを復帰でき、Keto 関係が再付与され
  PATCH update 等の owner 操作が認可を通る (非 deactivated は 400、非紐付けは 403)
- AccountEvent::Unbanned / Reactivated が rehydrate と tailing projector の両方で
  正しく状態復元・投影される
- usecase 単体テスト (mock) で正常系・guard 拒否・認可拒否・Keto 再付与が検証される

## Verification

- kernel EventApplier 単体テスト + usecase 単体テスト (mock)
- linkage query の driver 統合テスト
- 結合確認 (compose): ban → unban で moderation null、DELETE → reactivate で
  PATCH update が通ること
- `git diff --check`

## Related Links

- intent: intents/emumet/features/moderation/ (requirements / packets)
- 補完元: packets/backlog.md 完了セクション account-write-usecases 注記
  (「unban / reactivate は未実装のまま」)

## Knowledge Maintenance

- Intent placement: features/moderation/requirements.md / none new
- ADR candidate: none (reactivate の status 非リセット方針は
  features/moderation/decisions.md へ closeout 時記録)
- Diagram candidate: none
- Docs update: none (document 同期は Host-only backlog 項目)
- Closeout writeback expected: yes — features/moderation/packets.md への
  issue/PR リンク追記 (host-side、既定動作)

## Guide Reachability (G645)

Route declared: implementation-loop → unban admin API
(POST /api/v1/admin/accounts/{account_id}/unban) + reactivate client API
(POST /api/v1/accounts/{account_id}/reactivate) (packet.yaml guide_reachability 参照)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
