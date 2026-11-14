# hidden-quote-indication-contract Implementation Packet

## Goal

ShuttlePub の /api/v1 の直接表示契約(S8 `getPersonalNote` / `revealPersonalNote`)を拡張し、ブロック/ミュート中ドメインの投稿を第三者が引用した投稿を URL で開いたときに、「引用が理由で隠した」ことと引用元ドメインを型で示し、［この投稿だけ表示］(reveal)で引用元の投稿も含めて全体を表示する経路を、型・生成 OpenAPI schema・fixture・明示的な 501 route として固定する。実フィルタ・実 reveal は実装しない。

## Why

現行 S8 の `NotePresentation::Hidden` は mode・domain・revision だけで、「引用のせいで隠した」ことと引用元ドメインを示せず、`EmbeddedNotePresentation` / `DirectItem::Quote` の注記は「外側を reveal しても埋め込み元は隠したまま」と定めている。ユーザー決定(D08 ui-spec 3-4、「引用した投稿を開くと『（ブロック/ミュート）中のドメインの投稿を引用しています／引用元: <domain>』＋［この投稿だけ表示］、押すと引用元も含めて全体を表示」)を契約で表現できるようにするため。

## Scope

- `NotePresentation::Hidden` に必須の閉じた理由判別子 `cause`(`direct` / `quote`)。`cause=quote` のとき `domain`・`mode`・`revision` は引用元ドメインの E8 制御のもの。投稿自体の author も引用先も制御対象のときは `cause=direct`(domain は投稿自体の author 側)で、reveal は 1 回で両方解除
- 引用先が削除済み・閲覧権なしのとき引用元ドメインを漏らさないため `cause=quote` の Hidden を作らず、引用先は `Restricted` で内容なしにする
- `EmbeddedNotePresentation` から `Hidden` variant を取り除く(`Visible` / `Restricted` のみ)。reveal 1 回でその投稿と直接の引用先(1 つだけ)を同時に解除。CW・センシティブ・削除・閲覧権のゲートは reveal 後も Restricted
- reveal 前の Hidden は内容なしの閉じた型のまま(本文・投稿者・引用元本文・引用元投稿者を含めない)。ContractFixups の enum 閉鎖を更新
- `operations` は引用者本人の author ドメイン基準のまま(引用元ドメインのブロックで引用者への操作を制限しない)
- `fixtures/personal_domain/reveal.json`(`reveal_quote` ほか)の更新と引用が理由の隠し専用の新 fixture、`schema_cases.json` の embedded 系ケースの更新、`server/tests/personal_domain.rs` と schema テスト、docs(`server/docs/personal-domain-content-contract.md`)・fixtures README の更新、`openapi/shuttlepub.json` の再生成
- frontends が S8 生成 schema を SHA pin している場合の新 producer SHA への pin 更新が必要なことを docs に明記

## Out of scope

- 実フィルタ・実 reveal・enforcement、実投稿処理
- `FeedItem`(タイムライン・通知・検索)の変更。引用した投稿ごと痕跡なしで省略する現行(ui-spec 5-1〜5-3)は維持
- ブーストラッパーの直接 reveal、ネストした引用の帰属(未規定のまま)、reveal の永続化・同期
- note-search-api-contract(PR #23)の内容、既存 dev API の変更、frontends の UI 実装

## Verification

- 型・serialization テスト(`cause` の往復、欠落・未知値の拒否、Hidden の未知フィールド拒否、`EmbeddedNotePresentation` に hidden が無いこと)
- 生成 schema テスト(`cause` 列挙の閉鎖、Hidden の closed properties、`EmbeddedNotePresentation` の oneOf が Visible/Restricted のみ)と再生成差分なし
- reveal.json と新 fixture を schema と test-only 参照投影に照合(direct / quote / 二重原因 / 引用先削除・閲覧不可 / CW の Restricted / 引用者への操作が制限されない / 漏洩候補の拒否)
- タイムライン・通知・検索の引用ごと省略の既存 fixture・テストが変わらず通ること、全契約 route が 501、既存 S0/S3/S8 テストの回帰なし
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)と openapi 再生成差分 CI がグリーン

## Knowledge Maintenance (G461, optional)

- Intent placement: social-experience.md の D08 節に本 unit の依存・到達範囲・S8 注記の置き換えを追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: ui-spec 3-4 に API 側の対応を記録
- Closeout learning: cause 判別子、二重原因の扱い、引用先が削除・閲覧不可のときの漏洩防止、EmbeddedNotePresentation の破壊的変更を記録(`write_back_required: true`)
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation / ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`)

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
