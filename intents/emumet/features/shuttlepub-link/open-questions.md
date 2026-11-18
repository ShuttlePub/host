# shuttlepub-link — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) for domain-level open questions.

## Open questions blocking this feature

- 信頼モード② (受信の転送) を複数の link が持つとき、ダイレクトなどをどの link へ
  転送するか
- 信頼モードの正確な scope の割り当てと、モード変更・ホーム切替 (③ の付け替え) の手順
  (既存の relink 手順との関係)
- client_id と ShuttlePub の origin の対応表 (shuttlepub D32) を Emumet と Stellar の
  どちらが持つか (2026-11-18 の D36-D41 で未決に戻した)

## Resolved

- ~~連携先との認証方式~~ → **確定 (2026-11-18)**: Hydra を使っている間は DCR
  (shuttlepub D32)。「Emumet が client_id と origin の対応を持つ」は同日の D36-D41 で
  未決に戻した (上の open question)
- ~~1 アカウントが複数の ShuttlePub サービスと連携できるのか、1 つだけか~~
  → **確定 (2026-11-18)**: ホームの link (信頼モード③) は同時に 1 つ、参加の link は
  複数 (shuttlepub D31、ADR 0002 の 2026-11-18 追記)
- ~~連携先の登録は誰が行うか~~ → **確定 (2026-11-18)**: 本人が UI の認可確認画面で行う
  (shuttlepub D31)
