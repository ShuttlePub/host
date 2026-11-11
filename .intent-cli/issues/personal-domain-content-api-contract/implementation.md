# personal-domain-content-api-contract Implementation Packet

## Goal

ShuttlePub の /api/v1 に、個人 domain mute/block(D08)の投稿・検索・通知の抑制、引用・純粋 boost の全体非表示、URL 直接閲覧時の単一投稿 reveal、双方向(inbound/outbound)の新規 返信・引用・リポスト・いいね/絵文字の拒否結果を、型・serialization・生成 OpenAPI schema・fixture として確定させる。Profile 識別子・正規化 domain・revision は E8(Emumet PR #70)の契約に揃える。実 filter・実受理拒否・実投稿処理は実装せず、全 route は明示的な 501。

## Why

domain 方針は Emumet(E8/D8P)が持つが、投稿の表示 filter と投稿操作の受理・送信拒否は ShuttlePub の責務で、実処理は後続 unit。frontends が投稿表示面を作れるよう、先に契約を固定する。

## Scope

- timeline・検索・通知の 3 面の抑制契約(痕跡を出さない)、コメント付き引用全体・純粋 boost 全体の非表示
- hidden 応答の最小化(本文等を漏らさない)と payload 検査、単一投稿 reveal(block・CW・閲覧権を解除しない)
- inbound/outbound それぞれ 返信・引用・リポスト・いいね・絵文字を個別に契約化、D13 迂回禁止の例、既存反応件数の維持
- E8 の Profile 識別子(profile_nanoid / profile_id)・正規化 domain・revision との整合の明示
- schema fixture・hidden payload 検査・全 route 501 のテスト、openapi/shuttlepub.json の再生成

## Out of scope

- 実 filter、inbound Activity の実受理拒否、outbound の実拒否、実投稿・反応処理(将来の personal-domain-content-enforcement 相当 unit)
- domain 方針の保存・認可・正規化の再実装、新規 Follow の制御(Emumet の D8P/D8G/D8R)
- 既存反応の自動削除/Undo、AP Block、grill 未決項目(多段引用の帰属判定、Account 検索・一覧、通知/push 詳細等)の決定
- 既存 dev API の変更・schema 掲載、frontends の UI・mock

## E8 contract references

- Emumet openapi.json: `/api/v1/profiles/{profile_nanoid}/domain-controls[/{domain}]`、`DomainControlResponse`(profile_id=nanoid、domain=正規化済み、mode、revision)、`DomainControlMode`(mute|block)、`PutDomainControlRequest`(expected_revision)、`ProfileActorRef`(kind、actor_url)
- host `intents/emumet/features/personal-domain-controls/acceptance.md` の「E8 確定契約」「D8P 確定契約」(UTS #46 正規化・完全一致・不正 domain 422・revision 単調増加で再利用なし・actor ID の host による照合)
- host `intents/emumet/features/personal-domain-controls/overview.md`・`packets.md`、E8 packet `.intent-cli/issues/profile-domain-policy-api-contract/`

## Design notes

- domain 判定・方針の正本は Emumet。ShuttlePub の契約は E8 の表現を参照するだけで、独自の識別子・正規化・revision を持たない
- hidden 応答は「何が隠れたか」を示す最小の情報(種別・domain・revision)に限り、timeline・通知・検索では痕跡自体を出さない(直接閲覧・プロフィール等の明示的な hidden 表示と区別する)
- reveal は当該 1 投稿・当該閲覧の間だけの表示で、方針(revision)を変えない。block・CW/センシティブ・削除・閲覧権は reveal で解除しない
- いいねと絵文字は同じ許可判断でも wire 表現を別契約にする。mute に操作制限を追加しない。S3 の reaction PUT の既存契約を壊さない
- grill で未決の項目は契約に黙って決めた形を入れず、必要なら未決として issue に報告する

## Verification

- 各操作・表示面の schema fixture、hidden payload 検査、E8 整合の型テスト、集計 fixture、D13 迂回禁止 fixture
- schema テスト(dev API 非掲載)と再生成差分 CI、全 route 501 の route テスト、既存 Rust CI(fmt / clippy -D warnings / test / build / git diff --check)

## Knowledge Maintenance (G461)

- Intent placement: social-experience.md I08 節と candidates.md D08 節に S8 の unit・依存(S0・E8)・到達範囲(契約のみ)を追記。D08 に後続 owner(ShuttlePub)と未実装の enforcement unit を明記
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: I08 / D08 に契約範囲・E8 整合・検証境界を記録
- Closeout writeback expected: yes
