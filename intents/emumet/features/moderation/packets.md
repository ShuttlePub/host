# moderation — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

1. `moderation-role-assignment` — インスタンスロール(Admin/Moderator)割当管理 API
   (packet: `.intent-cli/issues/moderation-role-assignment/`) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/48** (merged 2026-08-21)
2. `moderation-account-report` — 通報(AccountReport)機能
   (packet: `.intent-cli/issues/moderation-account-report/`) — depends on: moderation-role-assignment —
   **completed: https://github.com/ShuttlePub/Emumet/pull/54**
   (issue https://github.com/ShuttlePub/Emumet/issues/53, merged 2026-08-23)。
   design: 2026-08-23 横断 grill (decisions.md D4 / interview 2026-08-23)**
3. `moderation-session-context` — 認証済みセッションの admin/moderator ロールを `GET /api/v1/me` で提供
   (packet: `.intent-cli/issues/moderation-session-context/`) — depends on: — (role 付与は `moderation-role-assignment` が担うが、本 unit はそれをブロッキングしない) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/18** (merged 2026-07-28)
4. `account-unban-reactivate` — unban (Banned→Active) admin API + reactivate (deactivated 復帰) client API + AccountEvent::Unbanned/Reactivated
   (packet: `.intent-cli/issues/account-unban-reactivate/`) — depends on: — (account-write-usecases の未実装ペア補完) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/50** (issue https://github.com/ShuttlePub/Emumet/issues/49, merged 2026-08-22)
5. `moderation-warning-event` — 通報「警告で解決」(resolve の resolution=warned 拡張) + AccountEvent::Warned + 警告履歴 API
   (packet: `.intent-cli/issues/moderation-warning-event/`) — depends on: moderation-account-report —
   **completed: https://github.com/ShuttlePub/Emumet/pull/60**
   (issue https://github.com/ShuttlePub/Emumet/issues/59, merged 2026-09-03)

## 未パケット化の残スコープ

- ホストモデレーション(リモートインスタンス単位の制限) — 要件整理から
