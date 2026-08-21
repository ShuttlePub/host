# moderation — design decisions

> See [overview.md](overview.md) for goals and [../../decisions/](../../decisions/) for cross-domain ADRs.

## Decisions

### D1: InstanceRole 割当・剥奪の認可は Keto `administrate` permit (admins のみ) — 2026-08-21

- Context: moderation-role-assignment (issue #45 / PR #48)。Admin が任意アカウントへ
  InstanceRole (Admin/Moderator) を付与・剥奪する admin REST API
  (`PUT/DELETE /api/v1/admin/accounts/{account_id}/roles/{role}`) を新設した。
- Decision: 認可には Keto Instance namespace に新設した `administrate` permit を使う。
  `moderate` permit (admins + moderators 包含) とは分離し、admins のみに限定する。
  書き込みは既存 `PermissionWriter` (KetoClient) 経由で `Instance:singleton` の
  関係タプルを作成/削除する (冪等: 再付与 409 / 未付与剥奪 404 は Ok 吸収)。
- Rationale: ロール割当はモデレーション操作より強い権限であり、Moderator に
  開放すべきではない。permit 分離により Keto 側で宣言的に表現できる。

### D2: Admin ロックアウト防止は「自己剥奪拒否」で代替する — 2026-08-21

- Context: 最後の Admin が剥奪されるとインスタンス管理不能になる。
- Decision: last-admin カウントによる剥奪防止は実装せず、操作者自身の Admin
  ロール剥奪を use case 層で `KernelError::Rejected` として拒否する
  (自分の Moderator 剥奪は許可)。
- Rationale: カウント方式は Keto 側の関係タプル走査が必要で複雑。
  自己剥奪拒否で通常経路のロックアウトは防げる。複数 Admin 同士の相互剥奪で
  全滅する経路は残るが、運用上のリスクとして許容する (issue #45 Out Of Scope 明記)。

### D3: reactivate は status を非リセットとする — 2026-08-22

- Context: account-unban-reactivate (issue #49 / PR #50)。deactivated アカウントの
  復帰 (reactivate) で status をどう扱うか。
- Decision: reactivate は deactivated 前の status を維持し、リセットしない。
  Banned + deactivated のアカウントは reactivate で Banned に戻る。
  ban の解除は unban で行う。
- Rationale: deactivation (ユーザー自身の退会) と ban (モデレーション操作) は
  独立した状態遷移であり、復帰操作がモデレーション状態を暗黙に解除すべきではない。