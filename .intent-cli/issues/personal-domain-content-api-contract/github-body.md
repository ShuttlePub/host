## Goal

ShuttlePub の /api/v1 に、個人 domain mute/block(D08)を投稿・検索・通知の表示面と投稿操作へ適用するための API 契約を定義する。(1) timeline・投稿検索結果・通知での対象 domain 由来の項目の抑制、(2) 対象 domain の投稿のコメント付き引用・純粋 boost の全体非表示、(3) URL 直接閲覧時の単一投稿 reveal、(4) 双方向(inbound / outbound)の新規 返信・引用・リポスト・いいね/絵文字リアクションの拒否結果を、型・serialization・生成 OpenAPI schema・fixture として確定させる。Profile 識別子・正規化 domain・revision は Emumet の E8 契約(Emumet PR #70)に揃える。実 filter・inbound Activity の実受理拒否・実投稿/反応処理は実装せず、全 route は明示的な 501 を返す。frontends の F8 第2段(投稿表示面)が準拠する producer 契約になる。

## Why This Slice Exists Now

D08 では、domain 方針(Profile × 正規化 domain の mute/block)は Emumet が持ち、新規 Follow の拒否も Emumet が実適用する。返信・引用・リポスト・いいね/絵文字の受理・送信拒否と、投稿・検索・通知の表示 filter は ShuttlePub 側の責務だが、その実処理は後続 unit になる。UI 先行の方針のもと、frontends が投稿表示面(隠し表示・reveal・ブロック中の操作)を作れるよう、先に契約を固定する必要がある。E8 は Emumet でマージ・closeout 済みで、依存する識別子・domain・revision の表現が確定している。

## Current Observed State

- S0(shuttlepub-openapi-foundation、PR #16)と S3(quick-reaction-api-contract、PR #17)はマージ済み。/api/v1 の共通エラー形式、routes! による単一登録、生成 schema(openapi/shuttlepub.json)、再生成差分 CI、`/api/v1/profiles/{profile_nanoid}/...` の命名が存在する
- E8(Emumet#66 / PR #70、squash 0bfa437)はマージ済みで、Emumet の openapi.json に `/api/v1/profiles/{profile_nanoid}/domain-controls` と `.../{domain}`(DomainControlResponse: profile_id・domain(正規化済み)・mode(mute|block)・revision)が定義されている。D8P は実保存・照合関数を実装済み(route は本番未 mount)、D8G は新規 Follow の block 適用を実装済み
- ShuttlePub に domain 方針に基づく表示 filter・投稿操作拒否は存在しない。返信・引用・リポスト・いいね/絵文字の新規受理・送信拒否も未実装
- 既存の開発 API(/api/notes/... 等)は legacy development API で契約対象外

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は server 層(Axum)に utoipa で実装し、そこから OpenAPI schema を生成する。生成 schema が契約の正本(S0 ADR)。契約のみの route は共通の構造化エラー形式による明示的な 501 stub で、成功応答として扱わない。`todo!()` / `unimplemented!()` は使わない
- E8 契約(再定義せず揃える。参照箇所):
  - Emumet openapi.json(ShuttlePub/Emumet main): `/api/v1/profiles/{profile_nanoid}/domain-controls`、`.../domain-controls/{domain}`、component schema `DomainControlResponse`(`profile_id` = Profile の nanoid、`domain` = 正規化済み、`mode`、`revision` = 1 始まり int64、`created_at`/`updated_at`)、`DomainControlMode`(`mute` | `block`)、`PutDomainControlRequest`(`expected_revision`)、`ProfileActorRef`(`kind`: local|remote、`actor_url`: canonical actor URL)、`ProfileResponse`(`id`、nullable な `username`)
  - host `intents/emumet/features/personal-domain-controls/acceptance.md` の「E8 確定契約」「D8P 確定契約」: domain 正規化規則(UTS #46 non-transitional、末尾ドット 1 つだけ除去、完全一致で `example.com` は `sub.example.com` を含まない、不正 domain は 422)、revision は作成・置換・削除・再作成のたびに +1 で tombstone により再利用されない、照合は検証済み canonical actor ID の host のみ(`ControlDomain::from_actor_id`)
  - host `intents/emumet/features/personal-domain-controls/overview.md`・`packets.md`、E8 packet `.intent-cli/issues/profile-domain-policy-api-contract/`
- D08 の製品決定(grill d08-q01〜q15、確定済み): 設定は Profile 単位で他 Profile に波及しない/表示抑制は mute・block 共通で timeline・検索・通知の 3 面/ブロック中は対象 domain から当該 Profile への新規 返信・引用・リポスト・いいね/絵文字を受理拒否し、D13 の投稿許可でも上書きできない/当該 Profile から対象 domain への同じ新規操作もブロック中は不可で、先に明示解除が必要(自動解除しない、mute には操作制限なし)/第三者のコメント付き引用は引用者コメントを含めて全体を隠す/ブロック・ミュートしていない人の純粋 boost も全体を隠す/URL 直接閲覧は初めは隠し、明示的に選べばその投稿だけ表示する(設定・他 filter は不変、削除・閲覧権・センシティブ/CW 等は迂回しない)/受理済みのいいね・絵文字の既存件数は維持し、新規拒否分は加算せず、過去分の自動削除/Undo はしない
- UI 側の合意(consumer 参考): host `intents/shuttlepub/features/personal-domain-controls-ui/ui-spec.md` の 3-x(直接 URL・プロフィール)・4-1(ブロック中の操作)・5-x(timeline・通知・検索に痕跡を出さない、既存件数は注記なし)
- API パス・フィールド名は S0・S3 の命名規約と E8 の表現に合わせて実装時に確定してよい。確定後の生成 schema が正本

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `server/`, `openapi/shuttlepub.json`

Target part: "Profile × 正規化 domain の mute/block を投稿・検索・通知の表示面へ適用する契約(抑制表現・引用/純粋 boost の全体非表示・単一投稿 reveal・双方向の新規投稿操作拒否)の型・schema・fixture・501 route"

## In Scope

- 表示面の抑制契約: timeline・投稿検索結果・通知の 3 面で、対象 domain 由来の項目を当該 Profile だけで抑制する表現。痕跡(件数・プレースホルダ・未読数加算・注記)を出さない形
- 全体非表示: 第三者のコメント付き引用の投稿全体、純粋 boost 全体
- hidden 応答: 種別(mute/block)・対象 domain(正規化済み)・E8 revision 等の最小限だけを持ち、本文・投稿者名・添付・CW 内容・メンション等を漏らさない表現と payload 検査
- 単一投稿 reveal: URL 直接閲覧時の初期 hidden と、明示的に選んだ 1 投稿だけの表示。設定・他投稿・引用内内容・他 filter を変えず、block・CW/センシティブ・削除・閲覧権を解除しない
- inbound 拒否契約: ブロック対象 domain から当該 Profile の投稿への新規 返信・引用・リポスト・いいね・絵文字リアクションの受理拒否結果(操作種別ごとに個別。いいねと絵文字は wire 表現を同一にしない)。D13 による block 迂回禁止の例
- outbound 拒否契約: 当該 Profile から対象 domain への新規 返信・引用・リポスト・いいね・絵文字の拒否結果(操作種別ごと)。ブロック中は先に明示解除が必要。S3 の reaction PUT との整合
- 既存反応件数の維持を示す集計表現(新規拒否分は加算されない)
- E8 との整合(Profile 識別子・正規化 domain・revision)の schema 説明/fixture での明示
- 型・serialization・schema・fixture・hidden payload 検査・全 route が 501 を返すテスト、openapi/shuttlepub.json の再生成とコミット

## Out Of Scope

- 実 filter(timeline・検索・通知の実抑制)、inbound Activity の実受理拒否、outbound 操作の実拒否、実投稿・実反応処理(将来の personal-domain-content-enforcement 相当 unit。本ユニットでは作らない)
- domain 方針(mute/block)の保存・更新・認可・正規化の再実装(Emumet の E8/D8P)
- 新規 Follow の受理・送信拒否、既存 Follow 関係の解除(Emumet の D8G/D8R)
- 既存の受理済み反応・リポストの自動削除/Undo、AP Block の送信
- Account 検索・一覧、多段引用の帰属判定、既存通知/push の詳細など grill で未決とされた項目の決定(未決のまま残し、契約に黙って決めた形を入れない)
- 既存 dev API の変更・削除・生成 schema への掲載
- frontends の UI・mock 実装(F8)

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の /api/v1 に、domain mute/block の表示面抑制・全体非表示・単一投稿 reveal・双方向の新規投稿操作拒否の契約を、E8 の Profile 識別子・正規化 domain・revision に揃えた型・OpenAPI schema・fixture・501 route として追加し、生成 schema を更新すること。実 filter・実受理拒否・実投稿処理は実装せず、契約外の dev API は schema に載せない。S0 の再生成差分 CI を含む既存 CI がグリーンであること。

## Acceptance Criteria

- E8 との整合: Profile 識別子は profile_nanoid(path)/ profile_id(応答、nanoid 文字列)、domain は E8/D8P の正規化済み表現(完全一致、不正は 422)、方針の世代は E8 の revision(1 始まり・単調増加・再利用なし)に揃え、独自の識別子・正規化・revision を導入しない。参照箇所(Emumet openapi.json の domain-controls と DomainControlResponse/DomainControlMode、host acceptance.md の E8/D8P 確定契約)と各フィールドの対応が schema 説明または fixture で確認できる
- 投稿・検索結果・通知の 3 面について、対象 domain 由来の項目を当該 Profile だけで抑制する契約が型と schema で表現される(mute/block 共通)。timeline・通知・検索には隠した痕跡(件数・プレースホルダ・未読数加算・注記)を出さない形が応答 fixture で示される
- 対象 domain の投稿を第三者がコメント付き引用した場合の引用投稿全体の非表示、ブロック/ミュートしていない人による純粋 boost 全体の非表示が、引用者コメントを含めて全体を隠す契約として表現される。引用者本人・無関係な投稿の自動 block/mute は契約に含めない
- hidden 応答は種別(mute/block)・対象 domain・E8 revision など最小限だけを持ち、本文・投稿者名・添付・CW 内容・メンション等を漏らさない。hidden 応答の payload 検査(禁止フィールド・値の不在)が fixture/テストで固定される
- 自サーバー内の URL 直接閲覧では初期状態で隠し、利用者が明示的に選んだときだけ当該 1 投稿を表示する単一投稿 reveal が契約化される。reveal は他の投稿・引用内の内容・設定(domain-controls の revision)を変えず、再読込・再訪で再び隠す性質を表現する。reveal しても block・CW/センシティブ・削除・閲覧権(可視性)を解除しない(それらの別制約は reveal 後も応答に残る)ことを fixture で示す
- inbound(ブロック対象 domain から当該 Profile の投稿への新規 返信・引用・リポスト・いいね/絵文字リアクション)の受理拒否結果を、操作種別ごとに個別の契約と fixture にする。いいねと絵文字は同じ許可判断でも wire 表現を同一にしない(別 fixture)。D13 の投稿許可設定があっても block を上書きできない(迂回禁止)例を fixture で示す
- outbound(当該 Profile から対象 domain への新規 返信・引用・リポスト・いいね/絵文字リアクション)の操作拒否結果を、操作種別ごとに個別の契約と fixture にする。ブロック中は先に明示的な解除を必要とし、操作による自動解除・ミュートへの操作制限追加を契約に含めない。S3 の reaction PUT との整合を取り、S3 の既存契約を破壊しない
- 受理済みのいいね/絵文字の既存反応件数はブロックだけでは減らさず維持され、新規拒否分は加算されない形が集計 fixture で示される(過去分の自動削除/Undo を示唆する型を作らない)
- 全契約 route が明示的な 501(S0 の共通エラー形式)を返し、routes! 単一登録で、todo!/unimplemented! を使わない。生成 schema(openapi/shuttlepub.json)は決定的に更新され、S0 の再生成差分 CI がグリーン。既存 dev API はこの契約・生成 schema に含まれない
- 実 filter・inbound Activity の実受理拒否・outbound の実拒否・実投稿/反応処理を実装していない。契約が「契約のみ・未実装」であることが schema の説明またはテストで確認できる

## Verification

- 各操作(inbound/outbound の返信・引用・リポスト・いいね・絵文字)と各表示面(timeline・検索・通知・直接閲覧・引用・純粋 boost)の schema fixture を生成 schema に照合する
- hidden 応答の payload 検査(本文・投稿者名・添付・CW 内容・メンション等の不在)。reveal 後に block・CW・閲覧権が残る fixture
- E8 との整合を確認する型・serialization テスト(profile_id/nanoid、正規化 domain、revision)
- 既存反応件数の維持と新規拒否分の非加算を示す集計 fixture、D13 迂回禁止の fixture
- schema テスト(生成 schema が契約と一致し、既存 dev API を含まないこと)と再生成差分なし(S0 の再生成差分 CI)
- 全契約 route が明示的な 501(共通エラー形式)を返す route テスト
- 既存 Rust CI(fmt / clippy -D warnings / test / build / git diff --check)がグリーン

## Related Links

- 先行ユニット: shuttlepub-openapi-foundation(ShuttlePub/ShuttlePub#14、PR #16)、quick-reaction-api-contract(ShuttlePub/ShuttlePub#15、PR #17、reaction PUT の整合対象)
- 依存(別 domain): profile-domain-policy-api-contract(E8、ShuttlePub/Emumet#66、PR #70)
- 後続ユニット: personal-domain-controls-web-ui(F8、ShuttlePub/shuttlepub-frontends#35、投稿表示面は本契約に準拠する mock)。将来の personal-domain-content-enforcement 相当の実処理 unit は未作成
- 意図: intents/shuttlepub/product/social-experience.md (I08)、intents/shuttlepub/packets/candidates.md (D08)、intents/emumet/features/personal-domain-controls/(overview.md・packets.md・acceptance.md)
- 決定記録: intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d08-q01〜q15)、intents/shuttlepub/decisions/generated-openapi-contract.md

## Knowledge Maintenance

- Intent placement: social-experience.md I08 節と candidates.md D08 節に S8 の unit・依存(S0・E8)・到達範囲(契約のみ)を追記(新規 intent ノード不要)。D08 に後続 owner が ShuttlePub であることと、将来の personal-domain-content-enforcement 相当 unit が未実装で残ることを明記
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: I08 / D08 に契約範囲・E8 との整合・検証境界を記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
