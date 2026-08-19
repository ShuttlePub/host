# moderation-role-assignment: InstanceRole(Admin/Moderator) 割当・剥奪の admin REST API (Keto PermissionWriter 経由)

## Goal

InstanceRole (Admin / Moderator) の付与・剥奪を行う admin REST API を新設する。
認可は Admin 限定の新規 Keto permit `administrate`、書き込みは既存の
`PermissionWriter` (KetoClient) 経由で `Instance:singleton` の関係タプルを
作成/削除する。

## Why This Slice Exists Now

moderation feature の残スコープの先頭。kernel の `InstanceRole` /
`RelationTarget::Instance` / `PermissionWriter` trait と KetoClient 実装
(冪等: 409/404 を Ok 吸収) は揃っており、欠けているのはユースケース層と
ルート層のみ。後続の通報機能 (moderation-account-report) はモデレーターの
操作主体が前提のため、ロール割当が先に必要。

## Current Observed State

- `PermissionWriter` (KetoClient) は実装済みだが、InstanceRole を書き込む
  ユースケース・ルートは存在しない
- Keto `namespaces.ts` の Instance permits は `moderate` (admins/moderators 包含)
  のみ。Admin 限定の permit は未定義
- `auth_emumet_accounts (emumet_id, auth_id)` テーブルはあるが、
  account → AuthAccount の逆引き query は未実装 (find_by_auth_id のみ)
- admin ルートは suspend/unsuspend/ban のみ (server/src/route/account/admin.rs)

## Accepted Baseline You May Assume

- Keto subject は AuthAccountId (AccountId ではない)
- KetoClient の PermissionWriter は冪等 (再付与 409 / 未付与剥奪 404 を Ok として返す)
- 認可は `check_permission` + `PermissionReq::instance(...)` パターンに倣う
- GET /api/v1/me が instance_roles を返す (moderation-session-context 完了済み)
- 1 Account の owner AuthAccount は 1 つ (逆引きは先頭を返す)

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

Target paths: `application/src/service/account, application/src/permission.rs, server/src/route/account, server/src/api/admin_account.rs, kernel/src/read_model, driver/src/database/postgres/account, ory/keto/namespaces.ts`

Target part: `InstanceRole 割当・剥奪ユースケース + admin REST API + Keto administrate permit + auth_emumet_accounts 逆引き query`

## In Scope

- Keto namespaces.ts: Instance permits に `administrate` 追加 (admins のみ)
- application: `instance_administrate()` helper + Assign/RevokeInstanceRoleUseCase
  (nanoid → Account 解決 → 逆引きで AuthAccountId 解決 → check_permission →
  PermissionWriter 経由で関係タプル作成/削除。DB トランザクション不要)
- read model: account → AuthAccountId 逆引き query (kernel facade + Postgres 実装)
- ルート: `PUT/DELETE /api/v1/admin/accounts/{account_id}/roles/{role}`
  (role = admin | moderator)、AdminAccountApi facade 拡張
- Revoke ガード: 自分自身の Admin ロール剥奪は Rejected

## Out Of Scope

- last-admin カウントによる剥奪防止 (自己剥奪防止で代替)
- ロール一覧 API (確認は GET /api/v1/me の instance_roles を使う)
- 通報 (AccountReport) 機能 (moderation-account-report のスコープ)
- ホストモデレーション、AccountRelation (Owner/Editor/Signer) の割当 API

## Standalone Child Issue Contract

Emumet に、Admin が任意アカウントへ InstanceRole (Admin/Moderator) を付与・剥奪する
admin REST API を追加する。エンドポイントは
`PUT /api/v1/admin/accounts/{account_id}/roles/{role}` (付与) と
`DELETE` 同パス (剥奪) で、role は `admin` | `moderator`。認可は Keto の
Instance namespace に新設する `administrate` permit (admins のみ) で行い、
Admin 以外は 403 を返す。対象アカウントは nanoid で指定し、Account 解決後に
`auth_emumet_accounts` の逆引き query (新規追加) で owner の AuthAccountId を得て、
既存の `PermissionWriter` (KetoClient) で `Instance:singleton` の関係タプルを
作成/削除する (冪等)。剥奪時のみ、操作者自身の Admin ロール剥奪は Rejected で
拒否する (ロックアウト防止)。付与結果は対象アカウント所有者の
GET /api/v1/me の instance_roles で確認できること。

## Acceptance Criteria

- Admin が PUT でロールを付与でき、Keto の Instance:singleton 関係タプルが
  作成される (再付与は冪等に成功)
- Admin が DELETE でロールを剥奪できる (未付与でも冪等に成功)
- Admin 以外 (Moderator・一般ユーザー) は 403 (PermissionDenied)
- 付与後、対象アカウント所有者の GET /api/v1/me の instance_roles に反映される
- 自分自身の Admin ロール剥奪は Rejected (400 系) で拒否される
- 不正な role 値は 400、存在しない account_id は 404
- use case 単体テスト (mock PermissionChecker/PermissionWriter) で認可拒否・
  自己剥奪拒否・正常系が検証される

## Verification

- use case 単体テスト (認可拒否 / 自己剥奪拒否 / 正常系 / NotFound / 冪等性)
- 逆引き query の driver 統合テスト (link → 逆引き → unlink 後 NotFound)
- 結合確認 (compose の keto 込み): Admin で PUT → 対象の GET /api/v1/me に反映。
  namespaces.ts 変更の反映手順 (keto 再起動要否) を確認
- `git diff --check`

## Related Links

- intent: intents/emumet/features/moderation/ (overview / requirements / packets)
- backlog: intents/emumet/packets/backlog.md (Ready #9)

## Knowledge Maintenance

- Intent placement: features/moderation/overview.md / none new
- ADR candidate: none (administrate permit・自己剥奪防止は features/moderation/decisions.md へ closeout 時記録)
- Diagram candidate: none
- Docs update: none (document 同期は Host-only backlog)
- Closeout writeback expected: no

## Guide Reachability (G645)

Route declared: implementation-loop → InstanceRole 割当・剥奪 admin REST API
(PUT/DELETE /api/v1/admin/accounts/{account_id}/roles/{role})
(packet.yaml guide_reachability 参照)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
