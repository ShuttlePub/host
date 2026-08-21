# account-unban-reactivate Implementation Packet

## Goal

モデレーション操作の未実装ペアを補完する。admin 向け unban (Banned → Active) と
owner 向け reactivate (deactivated 復帰) を、既存の UoW + Event Sourcing パターンで
実装する。kernel の AccountEvent に Unbanned / Reactivated を追加し、admin / client
それぞれの REST ルートを新設する。

## Why

ADR 0006 Stage 4 (account-write-usecases) で suspend/unsuspend/ban/deactivate は
UoW 化されたが、unban / reactivate は未実装のまま残った (packets/backlog.md 完了
セクションの注記)。Ban の解除手段がないとモデレーション運用が一方通行で誤 Ban を
戻せず、deactivate も復帰不能なため owner の自己削除が事実上の永久削除になっている。
カーネルのイベント・投影・認可の土台は揃っており、欠けているのはイベント 2 種と
ユースケース/ルートのみ。

## Scope

- kernel `kernel/src/entity/account.rs`:
  - AccountEvent に `Unbanned` / `Reactivated` variant を追加
  - `Account::unban(id, current_version)` / `Account::reactivate(id, current_version)`
    command constructor (Unsuspend / Deactivated の対称実装)
  - EventApplier: Unbanned は `is_banned()` guard → Active、Reactivated は
    `deleted_at.is_some()` guard → deleted_at = None。**status は変更しない**
    (Banned 状態で deactivate → reactivate すると Banned に戻る。解除は unban で行う)
- application:
  - `UnbanAccountUseCase` (moderation.rs に追加): find_by_nanoid_unfiltered →
    check_permission(instance_moderate) → tx 内 load → is_banned guard
    (非 Banned / deactivated は Rejected) → save。BanAccountUseCase の対称実装
  - `ReactivateAccountUseCase` (新規 reactivate.rs): owner 確認は Keto ではなく
    auth_emumet_accounts 紐付けで行う (deactivate で Keto 関係は削除済みのため)。
    削除込み linkage 確認 query (下記) → tx 内 load → deleted_at guard → save →
    post-commit で Keto Owner/Editor/Signer を再付与 (deactivate.rs の対称)
- read model: 削除込みの紐付け確認 query を kernel AccountQuery facade +
  Postgres 実装に追加 (例: `is_linked_including_deleted(auth_id, account_id)` または
  find_by_auth_id の unfiltered 版。find_by_auth_id は deleted_at IS NULL で
  フィルタされるためそのままでは使えない)
- ルート:
  - `POST /api/v1/admin/accounts/{account_id}/unban` (admin.rs、AdminAccountApi
    facade 拡張、ボディなし。エラーマッピングは既存 admin ルート準拠:
    PermissionDenied → 403、NotFound → 404、Rejected → 400)
  - `POST /api/v1/accounts/{account_id}/reactivate` (client.rs、AccountRouter に追加)
  - いずれも utoipa 注釈付き (OpenAPI 駆動のルート到達テストが自動カバー)

## Out of scope

- 通報 (AccountReport) — Ratcap admin-moderation 横断設計の grill 待ち (別 unit)
- suspend_expires_at 期限切れの自動 unsuspend (read 側で期限切れ扱い済み)
- reactivate 時の AP Delete 取り消し配送 (deactivate は連合に Delete を送っていない)
- Banned/Suspended アカウントの deactivate 禁止ルール追加 (現行仕様を維持)
- document リポジトリ同期 (Host-only backlog 項目)

## Verification

- kernel EventApplier 単体テスト: Unbanned guard (非 Banned で Internal)、
  Reactivated guard (非 deactivated で Internal)、rehydrate での状態復元
- usecase 単体テスト (mock PermissionChecker/PermissionWriter/Repository):
  unban 正常系・非 Banned Rejected・deactivated Rejected・非モデレーター 403、
  reactivate 正常系 (Keto 再付与 3 関係の呼び出し確認)・非 deactivated Rejected・
  非紐付け 403
- linkage query の driver 統合テスト (deactivated account の紐付けが引けること)
- 結合確認 (compose): admin が ban → unban で GET accounts の moderation が null、
  owner が DELETE → reactivate で PATCH update が認可を通ること
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/emumet/features/moderation/requirements.md (新規ノード不要)
- ADR candidate: なし (reactivate の status 非リセット方針は
  features/moderation/decisions.md に closeout 時記録)
- Diagram candidate: なし
- Docs update: なし (document 同期は Host-only backlog 項目)
- Closeout learning: reactivate の Keto 再付与の冪等性確認結果
  (write_back_required: false)

- Guide reachability (G645): packet.yaml の guide_reachability を参照
  (implementation-loop → unban admin API + reactivate client API)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
