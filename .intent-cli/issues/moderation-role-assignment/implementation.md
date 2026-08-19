# moderation-role-assignment Implementation Packet

## Goal

InstanceRole (Admin / Moderator) の付与・剥奪を行う admin REST API を新設する。
認可は Admin 限定の新規 Keto permit `administrate`、書き込みは既存の
`PermissionWriter` (KetoClient) 経由で `Instance:singleton` の関係タプルを
作成/削除する。併せて `auth_emumet_accounts` から account → owner AuthAccount の
逆引き read query を追加する。

## Why

moderation feature の残スコープの先頭 (features/moderation/packets.md unit 1)。
kernel の `InstanceRole` / `RelationTarget::Instance` / `PermissionWriter` trait と
KetoClient 実装は揃っており、欠けているのは「誰が・どの API で・どう対象を解決して
ロールを書き込むか」のユースケース層とルート層のみ。後続の
`moderation-account-report` (unit 2) はモデレーターの操作主体が前提のため、
ロール割当が先に必要。

## Scope

- Keto `ory/keto/namespaces.ts`: Instance permits に `administrate` を追加
  (admins のみ。moderators は含めない)
- `application/src/permission.rs`: `instance_administrate()` helper 追加
  (`PermissionReq::instance("administrate")`)
- read model: `auth_emumet_accounts` から account → AuthAccountId の逆引き query を
  kernel の AccountQuery 相当の facade + driver Postgres 実装に追加
  (1 Account の owner AuthAccount は 1 つという前提で先頭を返す。
  紐付けなしは NotFound)
- use case: `application/src/service/account/role.rs` (仮) に
  AssignInstanceRoleUseCase / RevokeInstanceRoleUseCase。
  依存は DependOnPermissionChecker + DependOnPermissionWriter +
  AccountQuery 系 facade。書き込みは Keto のみで DB トランザクション不要
  - 共通フロー: nanoid → find_by_nanoid_unfiltered → 逆引き query で
    AuthAccountId 解決 → check_permission(instance_administrate) →
    PermissionWriter create/delete_relation (RelationTarget::Instance{role})
  - Revoke 時のみ: 操作者自身の AuthAccountId かつ role = Admin なら
    KernelError::Rejected (自己 Admin 剥奪によるロックアウト防止)
- ルート: `PUT /api/v1/admin/accounts/{account_id}/roles/{role}` /
  `DELETE` 同パス (role = `admin` | `moderator`)。utoipa 注釈付き。
  AdminAccountApi facade を拡張。エラーマッピングは既存 admin ルートに倣う
  (PermissionDenied → 403、NotFound → 404、Rejected/不正 role → 400)

## Out of scope

- last-admin カウントによる剥奪防止 (自己剥奪防止で代替。必要になれば別 packet)
- ロール一覧 API (GET roles)。GET /api/v1/me の instance_roles が既存の確認経路
- 通報 (AccountReport) 機能 — unit 2 `moderation-account-report` のスコープ
- ホストモデレーション (リモートインスタンス単位の制限) — 未パケット化の残スコープ
- 既存 AccountRelation (Owner/Editor/Signer) の割当 API (アカウント作成時に自動付与済み)

## Verification

- use case 単体テスト (mock PermissionChecker/PermissionWriter):
  正常付与/剥奪、非 Admin の PermissionDenied、自己 Admin 剥奪の Rejected、
  未存在 account の NotFound、Keto 冪等性 (409/404 吸収) の回帰
- 逆引き query の driver 統合テスト (link → 逆引き → unlink 後 NotFound)
- 結合確認 (compose の keto 込み): Admin で PUT → 対象の GET /api/v1/me の
  instance_roles に反映されること。namespaces.ts 変更後の keto 再起動要否を
  確認し、必要なら compose / 手順に反映 (closeout learning に記録)
- `git diff --check`

## Knowledge Maintenance (G461, optional)

- Intent placement: intents/emumet/features/moderation/overview.md (新規ノード不要)
- ADR candidate: なし (administrate permit 新設・自己剥奪防止の判断は
  features/moderation/decisions.md に closeout 時記録)
- Diagram candidate: なし
- Docs update: なし (document リポジトリ同期は Host-only backlog 項目)
- Closeout learning: namespaces.ts permit 追加の反映手順・逆引き query 最終シグネチャ
  (write_back_required: false)

- Guide reachability (G645): packet.yaml の guide_reachability を参照
  (implementation-loop → InstanceRole 割当・剥奪 admin REST API)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
