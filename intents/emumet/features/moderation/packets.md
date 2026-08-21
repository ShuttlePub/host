# moderation — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

1. `moderation-role-assignment` — インスタンスロール(Admin/Moderator)割当管理 API
   (packet: `.intent-cli/issues/moderation-role-assignment/`) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/48** (merged 2026-08-21)
2. `moderation-account-report` — 通報(AccountReport)機能
   (packet: `.intent-cli/issues/moderation-account-report/`) — depends on: moderation-role-assignment —
   **on hold: Ratcap admin-moderation 横断設計の grill 待ち (2026-08-22 stack)**
3. `moderation-session-context` — 認証済みセッションの admin/moderator ロールを `GET /api/v1/me` で提供
   (packet: `.intent-cli/issues/moderation-session-context/`) — depends on: — (role 付与は `moderation-role-assignment` が担うが、本 unit はそれをブロッキングしない) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/18** (merged 2026-07-28)
4. `account-unban-reactivate` — unban (Banned→Active) admin API + reactivate (deactivated 復帰) client API + AccountEvent::Unbanned/Reactivated
   (packet: `.intent-cli/issues/account-unban-reactivate/`) — depends on: — (account-write-usecases の未実装ペア補完) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/50** (issue https://github.com/ShuttlePub/Emumet/issues/49, merged 2026-08-22)

## 未パケット化の残スコープ

- ホストモデレーション(リモートインスタンス単位の制限) — 要件整理から
