# block-mute — packets

> See [../../packets/](../../packets/) for domain-level packet list.

## Execution units

1. `block-mute-core` — ユーザーブロック/ミュート: エンティティと REST API の実装
   (packet: `.intent-cli/issues/block-mute-core/`) —
   **published: https://github.com/ShuttlePub/Emumet/issues/16** (intent-target) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/17** (merged 2026-07-25)
2. `block-mute-federation` — ActivityPub 連合(Block アクティビティ送受信)
   (packet: `.intent-cli/issues/block-mute-federation/`) — depends on: block-mute-core —
   **published: https://github.com/ShuttlePub/Emumet/issues/22** (intent-target) —
   **completed: https://github.com/ShuttlePub/Emumet/pull/23** (merged 2026-08-13)
3. `block-mute-followups` — レビュー観測 3 件の消化 (重複 Block no-op 固定・
   エラーパステスト・Iceshrimp S10 Undo(Block) 相手側観測)
   (packet: `.intent-cli/issues/block-mute-followups/`) — depends on: block-mute-federation
