## Goal

ShuttlePub の /api/v1 の直接表示契約(マージ済み S8 の `getPersonalNote` / `revealPersonalNote`)を拡張し、ブロック/ミュート中ドメインの投稿を第三者が引用した投稿を URL で開いたときに「引用が理由で隠した」ことと引用元ドメインを型で示し、［この投稿だけ表示］(reveal)で引用元の投稿も含めて全体を表示する経路を、型・生成 OpenAPI schema・fixture・明示的な 501 route として固定する。実フィルタ・実 reveal は実装しない。

## Why This Slice Exists Now

D08 ui-spec 3-4 のユーザー決定: 「（ブロック/ミュート）中のドメインの投稿を引用しています／引用元: <domain>」＋［この投稿だけ表示］を出し、押すと引用された元の投稿も含めて全体を表示する。現行 S8 の `NotePresentation::Hidden` は種別・ドメイン・revision だけで「引用のせいで隠した」ことを示せず、`EmbeddedNotePresentation` / `DirectItem::Quote.quoted_note` の注記は「外側を表示しても埋め込み元は隠したまま」と定めているため、この UI を契約で表現できない。

## Current Observed State

- S8(PR #19)は ShuttlePub main にマージ済み。`NotePresentation` は `Hidden { mode, domain, revision }` / `Visible { item, operations, reaction_counts }` / `Restricted { reason, operations }`。`Hidden` はなぜ隠したか(直接の対象か引用か)を区別できず、引用元ドメインも持てない
- `EmbeddedNotePresentation`(`Visible` / `Hidden` / `Restricted`)は、外側の reveal で引用元を表示しない旨を定め、`reveal.json` の `reveal_quote` と `server/tests/personal_domain.rs`、`server/docs/personal-domain-content-contract.md` にも同じ記述がある
- FeedItem(タイムライン・通知・検索)は引用先が制御ドメインの引用を引用者のコメントごと痕跡なしで省略する(ui-spec 5-1〜5-3)。これは変えない

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は server 層(Axum + utoipa)で、生成 schema `openapi/shuttlepub.json` が契約の正本(S0 ADR)。ハンドラーは明示的な 501(`todo!`/`unimplemented!` は使わない)。S0 の再生成差分 CI がある
- S8 の維持事項: reveal は永続化せずそのページの間だけ有効(E8 revision を変えない、再読込・再訪で再び隠す、再利用可能な reveal token なし)。操作可否は引用者本人の author ドメイン基準(引用元ドメインは操作を制限しない)。CW/センシティブ/削除/閲覧権のゲートは reveal 後も Restricted。ブーストラッパーの直接 reveal とネストした引用の帰属は未規定
- reveal 前に本文・引用元本文を返さない内容漏洩防止は維持する(Hidden は閉じた型。schema と serde が未知フィールドを拒否し、`ContractFixups` の enum 閉鎖が生成 schema に反映される)
- 同じ `personal_domain.rs`・`openapi/shuttlepub.json` を触る note-search-api-contract(ShuttlePub PR #23)が未マージの場合がある。競合は先にマージされた方に合わせて再生成して解消し、相手のブランチは触らない

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `server/`, `openapi/shuttlepub.json`

Target part: "S8 personal-domain の直接表示(getPersonalNote / revealPersonalNote の NotePresentation・EmbeddedNotePresentation・DirectItem)を拡張する、hidden 理由の判別子(直接の対象か引用か)と引用元ドメイン、reveal で引用元も表示する経路(型・schema・fixture・501 route)"

## In Scope

- `NotePresentation::Hidden` に必須の閉じた理由判別子 `cause`(`direct` / `quote`)。`direct` は投稿自体の author が制御ドメイン、`quote` は投稿自体の author は制御対象でなく直接の引用先が制御ドメイン。`cause=quote` のとき `domain`・`mode`・`revision` は引用元ドメインの E8 制御のもの。author も引用先も制御対象なら `cause=direct`(domain は投稿自体の author 側)で、reveal は 1 回で両方を解除する
- 引用先が削除済み・閲覧権なしのときは、引用元ドメインを漏らさないため `cause=quote` の Hidden を作らず、引用先を `Restricted`(内容なし)で返す
- `EmbeddedNotePresentation` から `Hidden` variant を取り除く(`Visible` / `Restricted` のみ)。reveal 1 回でその投稿とその直接の引用先(1 つだけ)を同時に解除する。CW・センシティブ・削除・閲覧権のゲートは reveal 後も Restricted
- reveal 前の Hidden は state・cause・mode・domain・revision だけの閉じた型(本文・投稿者・メディア・CW 文・メンション・引用元の本文・投稿者を持てない)
- `operations` は引用者本人の author ドメイン基準のまま(引用元ドメインのブロックで引用者への操作を制限しない)
- `reveal.json` の `reveal_quote` の更新、引用が理由の隠し専用の新 fixture、`schema_cases.json` の embedded 系ケース更新、`server/tests/personal_domain.rs`、docs(`server/docs/personal-domain-content-contract.md`)・fixtures README の更新、`openapi/shuttlepub.json` の再生成。frontends が S8 生成 schema を SHA pin している場合は新 producer SHA への pin 更新が必要なことを docs に明記

## Out Of Scope

- 実フィルタ・実 reveal・enforcement、実投稿処理
- `FeedItem`(タイムライン・通知・検索)の変更(引用した投稿ごと痕跡なしで省略する現行を維持)
- ブーストラッパーの直接 reveal、ネストした引用の帰属、reveal の永続化・同期
- note-search-api-contract(PR #23)の内容、既存 dev API の変更、frontends の UI 実装

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の既存 S8 直接表示契約を拡張し、`NotePresentation::Hidden` に必須の閉じた判別子 `cause`(`direct` / `quote`)を加え(`quote` のとき domain・mode・revision は引用元ドメインの制御のもの)、`EmbeddedNotePresentation` から `Hidden` を取り除いて reveal 1 回で引用元も同時に表示する形(CW・削除・閲覧権のゲートは Restricted のまま)に変更し、引用先が削除・閲覧不可のときは引用が理由の隠しを作らず、FeedItem・タイムライン・検索・通知は不変のまま、型・生成 OpenAPI schema・fixture・明示的な 501 route として固定し生成 schema を更新すること。実フィルタ・実 reveal は実装せず、既存 S0/S3/S8 のテスト(hidden/reveal/embedded の検証更新を除く)と再生成差分 CI を含む既存 CI がグリーンであること。

## Acceptance Criteria

- 判別子: `Hidden` が必須の閉じた `cause`(`direct` / `quote`)を持つ。`quote` のとき domain は引用元(引用先 author)の canonical actor ID host、mode・revision はその E8 制御のもの。`direct` のとき投稿自体の author ドメインの制御のもの。author と引用先の両方が制御対象なら `direct`。Hidden のフィールドは state・cause・mode・domain・revision だけで、schema と serde が未知フィールドを拒否し、生成 schema の `cause` 列挙が閉じている
- 引用先が削除済み・呼び出し側に閲覧権が無い場合は `cause=quote` の Hidden を作らず Restricted(deleted / visibility)。ネストした引用の帰属は未規定と docs に明記
- reveal: 1 回の明示操作で投稿と直接の引用先(1 つだけ)を同時に解除する。`EmbeddedNotePresentation` は Visible / Restricted のみで、`quoted_note` は reveal 後に Visible になりうる。引用元側の CW・センシティブ・削除・閲覧権のゲートは Restricted のまま内容なし。他の投稿・さらに先の引用・ブロック・E8 revision は変えない。引用元ドメインがブロックでも reveal 後の引用者への操作は制限されない
- GET の初期表示は直接でも引用が理由でも reveal 前は Hidden(内容なし)で、引用が理由のときだけ `cause=quote` と引用元ドメイン・mode を返す。Hidden の他の挙動(Profile 封筒、403/404、reveal は永続化・同期・キャッシュしない)は S8 のまま
- タイムライン・検索・通知は不変: FeedItem に hidden variant を足さず、引用先が制御ドメインの引用を引用者のコメントごと痕跡なしで省略する S8 の契約・fixture・テストが変わらず通る
- fixture: 直接の対象 → direct、引用元が制御ドメイン → quote と引用元ドメイン、author と引用先の両方 → direct、引用先が削除・閲覧不可 → quote を作らず Restricted、reveal で引用元が Visible、引用元が CW/センシティブなら reveal 後も Restricted、reveal 後も引用者への操作が制限されない、reveal 前の Hidden が引用元の本文・投稿者を含まない(漏洩候補の schema/serde 拒否)、cause 欠落・未知値の拒否、EmbeddedNotePresentation に hidden が無いこと、タイムライン/検索/通知は引用ごと省略のまま
- 全契約 route が明示的な 501(S0 の共通エラー形式)、`routes!` 単一登録、`todo!`/`unimplemented!` なし。生成 schema は決定的に更新され再生成差分 CI がグリーン。docs・fixtures README から旧記述(外側の reveal は引用元を隠したまま)が消え、『契約のみ・未実装』が schema 説明またはテストで確認できる

## Verification

- 型・serialization テスト(`cause` の往復、欠落・未知値・Hidden 未知フィールドの拒否、`EmbeddedNotePresentation` に hidden が無いこと)と生成 schema テスト(`cause` 列挙の閉鎖、Hidden の closed properties、Embedded の oneOf)、再生成差分なし
- reveal.json と新 fixture を schema と test-only 参照投影に照合
- タイムライン・通知・検索の既存 fixture・テスト、全契約 route の 501、既存 S0/S3/S8 テストの回帰なし
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)と openapi 再生成差分 CI がグリーン

## Related Links

- 正本 UI 仕様: host `intents/shuttlepub/features/personal-domain-controls-ui/ui-spec.md`(3-4、5-1)
- grill: `d08-q06-hide-entire-third-party-quotes`、`d08-q07-explicit-reveal-on-direct-open`
- 依存: マージ済み S8(personal-domain-content-api-contract、PR #19)。同じファイルを触る note-search-api-contract(PR #23)

## Knowledge Maintenance

- Intent placement: social-experience.md の D08 節に本 unit の依存・到達範囲・S8 注記の置き換えを追記(新規 intent ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: ui-spec 3-4 に API 側の対応を記録
- Closeout writeback expected: yes(cause 判別子、二重原因の扱い、引用先が削除・閲覧不可のときの漏洩防止、EmbeddedNotePresentation の破壊的変更)

## Guide Reachability (G645)

`guide workflow task implementation-loop` / implementation / `ShuttlePub/ShuttlePub` (`server/`, `openapi/shuttlepub.json`)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
