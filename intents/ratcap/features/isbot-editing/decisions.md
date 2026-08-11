# isbot-editing — design decisions

> See [overview.md](overview.md) for goals and [../../decisions/](../../decisions/) for cross-domain ADRs.

## Decisions

- D1: `isBot` は既存 `UpdateProfileInput` に追加する（専用の `updateAccount` ミューテーションは新設しない）。
  - 理由：アカウント詳細編集フォームで 1 回の保存で複数プロフィール項目を更新しているため、同じ `updateProfile` に含めるのが自然。
  - 影響：PureScript 側で既存 `UpdateProfileInput` 型を使う箇所すべてに `isBot` フィールドが追加される。
- D2: BFF 型名は camelCase `isBot`、Emumet 送信時は snake_case `is_bot` とする。
  - 理由：既存 DTO 変換規則（displayName → display_name、iconUrl → icon_url など）に合わせる。
  - 該当箇所：`bff/emumet/real.ts` の `updateAccount` リクエストボディ変換箇所。
- D3: UI は `src/View/AccountDetail.purs` の編集タブ/フォーム内に既存フィールドと同じセクションに配置する。
  - 理由：新規ルートやページを作るほどの規模ではない。既存フォームに 1 行追加するだけで済む。
- D4: 未指定時の動作は Emumet 側に現状値を維持させるため、`isBot` を省略可能（`Boolean` nullable）にする。
  - 理由：既存フィールド（summary 等）も同様に省略時に既存値を維持する設計になっているはずであり、整合性を取るため。
- D5: 型再生成と PureScript ビルドは実装 PR 内で必ず実行し、生成物をコミットする。
  - 理由：`src/Generated/` は git 管理対象であり、GraphQL スキーマ変更と同期させる必要がある（README 記載）。
- D6: is_bot は作成時のみ設定可能とし、作成後の編集 UI は提供しない (2026-08-11 オペレーター決定)。
  - 理由：Emumet は ShuttlePub サービスのアカウント管理機能を提供することが目的であり、bot→人間等の後付け変更は用途上不自然。作成時に確定させるのが自然。
  - 影響：D1（`UpdateProfileInput` への追加）・D3（AccountDetail 編集フォームへの配置）は**破棄**。代わりに `CreateAccountInput.isBot` + `AccountNew` フォームへの追加とする。D2 の命名規則（camelCase↔snake_case）と D5 の生成物コミット規則は継続。
  - 補足：Emumet の `CreateAccountRequest` は `is_bot` を必須フィールドとして既に受け付けるため、バックエンド変更不要。
