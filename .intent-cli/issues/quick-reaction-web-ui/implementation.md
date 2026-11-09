# quick-reaction-web-ui Implementation Packet

## Goal

apps/shuttlepub-web に、クイックリアクション UI を実装する。ピッカー最上段に常用絵文字(最大 5)を表示し、反応済みの投稿ではピッカーの代わりに選択中の絵文字を表示して押すと解除してピッカーを再表示する(1 人 1 投稿 1 反応)。常用絵文字を設定する Profile 設定 UI も含む。受け入れは S3 の API 契約に準拠するステートフル mock で行い、実保存 backend や端末間同期が完成したとは表示しない。

## Why

D03(クイックリアクション)の製品意図は grill で確定している(常用絵文字は同じ Profile で端末間共通、ピッカー最上段、反応済みは選択絵文字を表示して解除)。ShuttlePub backend の実装を待たず、UI 先行方針に従い、S3 の契約に準拠する mock を使って UI を完成させる。

## Scope

- リアクションピッカー最上段の常用絵文字(最大 5、利用不可はグレーアウト)
- 反応済み表示(選択中の絵文字)と押下での解除・ピッカー再表示、1 人 1 投稿 1 反応
- 常用絵文字の Profile 設定 UI(最大 5・一意・順序、利用不可表示、revision 競合・失敗・再送の処理)
- 二重送信防止・送信失敗・Profile 切替の処理
- S3 準拠のステートフル mock(複数 session から同一 Profile を参照)と、mock 受け入れ用の fixture(S3 の fixture を再利用/照合)
- UI テスト・visual baseline(mobile / desktop)とキーボード操作
- 【モック合意後】ピッカー・反応済み表示・常用絵文字設定画面を含む UI の実装(ゲート対象。実装前に host intent の合意記録を参照)

## Out of scope

- ShuttlePub 実保存・端末間同期の完成の主張(実保存 backend が未実装であることを完成と表示しない)
- dev reaction API(POST /api/notes/{id}/reactions)の呼び出し
- FA(実認証)への依存。mock 受け入れに FA は不要
- 異なる Profile 間・Account 全体での設定共有、D05 / D13 の設定
- モック合意前の画面構成の独自決定

## Design notes

- UI 状態機械: 未反応 → (ピッカーで選択) → 反応済み → (選択絵文字を押下) → 未反応(ピッカー再表示)。置換は解除経由のみ
- 利用可否は応答の値で描画し、解除操作は利用可否に依存させない
- UI はゲート対象。モック合意(host intent に記録)を参照してから実装し、それまでは画面を伴わない mock・状態ロジックに留める

## Verification

- S3 準拠 stateful mock に対する UI テスト(0 / 5 件、未反応→選択、反応済み→解除→ピッカー再表示、利用不可、利用不可の選択済み反応の解除、二重送信、失敗、revision 競合、Profile 切替)
- 複数 session から同一 Profile の設定を参照するテスト
- fixture / mock 応答が S3 の生成 schema に照合されること
- visual baseline(mobile / desktop)とキーボード操作テスト
- dev reaction API が呼ばれないことのテスト、既存 CI と git diff --check がグリーン

## Knowledge Maintenance (G461)

- Intent placement: social-experience.md I03 節と candidates.md D03 節へ F3 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: UI の到達範囲(mock 受け入れ・実保存未完成)と検証境界を I03 / D03 に記録
- Closeout writeback expected: yes
