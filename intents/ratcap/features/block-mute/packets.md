# block-mute — packets

> ドメイン全体のパケット一覧は [../../packets/](../../packets/) を参照。

## Execution units

### Packet 1: BFF ブロック / ミュート層

- **対象ファイル**
  - `apps/emumet-web/bff/schema.graphql`
  - `apps/emumet-web/bff/emumet/client.ts`
  - `apps/emumet-web/bff/emumet/real.ts`
  - `apps/emumet-web/bff/emumet/mock.ts`
  - `apps/emumet-web/bff/resolvers.ts`
  - 新規 `apps/emumet-web/bff/resolvers.test.ts` または既存 BFF テストファイル

- **作業内容**
  - `Relation` 型、 `RelationConnection` 型、 4 つの GraphQL 操作(`blocks` / `mutes` query、 `unblockAccount` / `unmuteAccount` mutation)を SDL に追加する(2026-08-11 スコープ変更: 追加系 mutation は含めない)。
  - `EmumetClient` インターフェースに 4 メソッド(`listBlocks` / `listMutes` / `unblock` / `unmute`)を追加する。
  - `real.ts` で Emumet REST エンドポイントを呼び出し、 snake_case ↔ camelCase 変換を実装する。
  - `mock.ts` にインメモリのブロック / ミュートストアを追加し、同一プロセス内で状態を保持する(初期データで一覧を確認できるようにする)。
  - `resolvers.ts` に 4 つのリゾルバを追加する。
  - BFF テストに mock client を使った mutation / query テストを追加する。

- **完了条件**
  - `bun test`（apps/emumet-web 配下） が既存テストを含めて全て通る。
  - `apps/emumet-web/bff/schema.graphql` の変更後、 `(cd apps/emumet-web && bun scripts/sync-graphql.ts)` がエラーなく実行できる。

### Packet 2: PureScript GraphQL クライアントと状態管理

- **対象ファイル**
  - `apps/emumet-web/src/App/Api/GraphQL.purs`
  - `apps/emumet-web/src/App/Api/GraphQL/Types.purs`（必要に応じて `RelationResponse` を追加）
  - `apps/emumet-web/src/App/Message.purs`
  - `apps/emumet-web/src/App/Model.purs`
  - `apps/emumet-web/src/Client/Update.purs`
  - `apps/emumet-web/src/Generated/`（再生成）

- **作業内容**
  - `(cd apps/emumet-web && bun scripts/sync-graphql.ts)` を実行して生成型を更新する。
  - `RelationResponse` 型とその Decode/Encode インスタンスを追加する。
  - `GraphQL.purs` に 4 つの関数を追加する。
  - `Message.purs` にブロック / ミュート関連の Message を追加する。
  - `Model.purs` に `blocks` / `mutes` の `RemoteData` フィールドを追加する。
  - `Update.purs` に各 Message のハンドラを追加し、操作成功後にローカル state を更新または再フェッチする。

- **完了条件**
  - `spago build` が成功する。
  - 新しい GraphQL 関数が型検査を通る。

### Packet 3: UI 実装とルーティング

- **対象ファイル**
  - `apps/emumet-web/src/App/Route.purs`
  - `apps/emumet-web/src/App/View.purs`
  - `apps/emumet-web/src/App/View/AccountDetail.purs`
  - `apps/emumet-web/src/App/View/Settings.purs` または新規 View ファイル
  - `packages/ui/src/ShuttlePub/UI/Theme.purs`（必要に応じてボタン用クラス追加。2026-08-30 抽出済み、app 内では `ShuttlePub.UI.Theme` 参照）

- **作業内容**
  - ブロック / ミュート一覧を Settings 配下のセクションとして表示する(2026-08-11 スコープ変更: AccountDetail への追加ボタンは実装しない)。
  - 一覧 View で `RelationResponse` を受け取り、 `targetType` / `target` をテーブルまたはカード形式で表示する。
  - 一覧項目に解除ボタンを配置し、 `UnblockAccount` / `UnmuteAccount` Message を発行する。

- **完了条件**
  - `spago build` と `spago test` が成功する。
  - `./scripts/dev.sh mock` 起動後、ブラウザでブロック / ミュートの一覧・解除が動作する。
