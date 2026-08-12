# block-mute — design decisions

> See [overview.md](overview.md) for goals and [../../decisions/](../../decisions/) for cross-domain ADRs.

## Decisions

### 2026-08-12: Mute は連合に通知しない (block-mute-federation packet 時に確定)

- Mute はローカルのみで機能し、ActivityPub 連合には通知しない
  (acceptance 基準とも一致。連合するのは Block のみ)
- Block は Follow と同様の純粋 CRUD を継続し、Event Sourcing 対象にしない
- 外向き Block/Undo(Block) 配送の失敗セマンティクスは outbound_unfollow に揃える:
  deliver → mutate の順とし、配送失敗時はローカル状態を変えずにエラーを返す
- Undo(Block) は元の Block アクティビティを embedded object として wrap し、
  activity id は block 行の永続 id から再構成する (配送時と同一 id を参照できる)

### 2026-08-13: フォローアップ候補 (PR #23 レビュー観測事項、非 blocking)

- 重複 Block 受信時に follow 再解除を再実行しない (first-delivery 時のみ)。
  再フォロー防止機構ができるまでは実害なし
- inbox Block/Undo(Block) ハンドラのエラーパス単体テスト拡充
  (重複配送・unknown actor・他人 inbox 宛の拒否)
- Iceshrimp E2E (S10) で Undo(Block) の相手側受信をポーリング検証する assert の追加