# emumet-login-consent-boundary Review Context

Review that this slice moves operation toward the documented intent without widening scope.

Flag findings if the implementation:

- widens scope beyond the issue contract;
- launches AI providers from `intent-cli`;
- mutates GitHub or parent state when the issue is read-only;
- skips required contract sections.

## Facet context

<!-- BEGIN GENERATED FACET CONTEXT (G530) -->
### vocabulary
- (none overlapping this packet's intent_references)
### invariant
- (none overlapping this packet's intent_references)
### decider
- (none overlapping this packet's intent_references)
### acceptance-property
- (none overlapping this packet's intent_references)
<!-- END GENERATED FACET CONTEXT (G530) -->

## Packet-specific review points

- 外から見える挙動の不変 (A1-1〜A1-3): URL・302 の Location・JSON・scope・audience・remember・email claim・subject・Kratos セッション Cookie だけを渡すこと・Kratos 検証失敗→Hydra login reject (login_required)・Kratos 通信失敗/5xx→502 (reject にしない)・scope 超過→400。
- 既存の route テスト (route/oauth2/login.rs・consent.rs の mod tests、route/tests.rs) のテスト関数本体と期待値が変更されていないこと。変更があれば PR 本文の理由を確認する。
- 境界 (A1-5・A1-9): kernel/application/driver の login/consent の型・port・service・client が Account・Profile・link・AuthAccount・DB に依存していないこと。route が入出力の変換だけで、`OAuth2Api` が生の hydra/kratos client を返していないこと。utoipa 型が server の外に出ていないこと。
- 本体に残すもの (A1-6): JWT 検証・JWKS・Account/Profile/link・KratosRegistrationFlowDirectory・登録ゲートが移動・変更されていないこと。
- 追加していないもの (A1-7): DCR、client_id↔origin の対応表、DB マイグレーション、新しい環境変数・route、openapi.json の差分。
- 追加テスト (A1-4): DB を使わないユースケースのテストと、Ory のエラーごとの driver/ユースケースのテストがあること。
- PR 本文に、基準の完全な SHA、依存方向の確認方法と結果、既存テストを無変更で通した結果、openapi 差分なしの確認があること。

## Knowledge Writeback Expectation (G461)

If the packet's `closeout_learning.write_back_required` is `true`, confirm the
expected intent-tree / ADR / diagram / docs writeback landed in this PR or was
captured as a follow-up packet. If the packet declined all knowledge maintenance,
that is acceptable — note it rather than blocking.