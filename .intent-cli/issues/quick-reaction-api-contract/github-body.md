## Goal

ShuttlePub の /api/v1 に、クイックリアクション用の API 契約を定義する。(1) Profile 単位の常用絵文字設定(順序付き最大5件・一意・revision)の GET/PUT、(2) Profile×投稿の reaction の GET/PUT/DELETE を、型・serialization・生成 OpenAPI schema・fixture として確定させる。実保存・端末間同期の実処理・投稿処理は実装せず、route は明示的な 501 を返す。frontends の UI とステートフル mock が準拠する producer 契約になる。

## Why This Slice Exists Now

UI を先行させる方針のもと、ShuttlePub backend 実装を待たずに frontends がクイックリアクション UI を作れるよう、先に API 契約を固定する必要がある。常用絵文字設定の保存先を ShuttlePub backend の Profile 単位に置く決定(d03-q07)は済んでいるが、具体的な API 契約は未定義。S0 の OpenAPI 基盤ができ次第、その上に載せる最初の業務契約になる。

## Current Observed State

- ShuttlePub main に Profile 単位の設定 API・保存は存在しない
- 既存の開発 API `POST /api/notes/{id}/reactions`(server/src/lib.rs の router、認証なし・in-memory)が 1 人 1 投稿 1 反応の現行挙動を持つ
- S0 完了後に /api/v1 の共通エラー形式と生成 schema 基盤が存在する前提(本ユニットは S0 に依存)

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は ShuttlePub/ShuttlePub の server 層(Axum)に utoipa 等で実装し、そこから OpenAPI schema を生成する。ハンドラーの本実装はこの段階では行わない。frontends の SNS UI はこの生成 schema を使う。旧 docs/openapi.json は廃止予定で互換を考慮しない
- S0 が提供する utoipa 基盤・共通エラー形式・schema 再生成手順・差分 CI を使う
- 製品意図(確定済み): 常用絵文字は同じ投稿用 Profile 内で端末間共通、最大 5 個。未反応投稿ではリアクションボタンで開くピッカー最上段に表示。反応済み投稿は選択中の絵文字をボタンの代わりに表示し、押すと解除してピッカーを再表示。反応の変更は解除後にピッカーで選ぶ(UI がピッカーから直接置換はしない)。常用未設定ならピッカー最上段の常用欄なし(サーバー管理の初期値絵文字は導入しない)。利用不可の常用絵文字はグレーアウトし選択不可、設定画面で「利用不可」と表示。別絵文字での代替送信・設定の自動削除はしない
- 1 人 1 投稿 1 反応は現行 dev API の挙動で、UI 向けの正本契約は /api/v1/... のみ。dev API は legacy development API として契約対象外
- API パス・フィールド名は S0 の命名規約に合わせて実装時に確定してよい。確定後の生成 schema が正本

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `server/`, `openapi/shuttlepub.json`

Target part: "Profile 単位の常用絵文字設定 API と Profile×投稿の reaction API の契約(型・schema・fixture・501 route)"

## In Scope

- Profile 設定 GET/PUT: 順序付き常用絵文字(0〜5 件)、一意性、revision(楽観的競合検出)、各絵文字の利用可否表現
- Profile×投稿 reaction GET/PUT/DELETE: 未反応・選択済み・置換(別絵文字での PUT)・解除。1 Profile・1 投稿・1 反応
- 絵文字識別: Unicode 絵文字と custom emoji の識別子表現、利用可能性(利用不可)の表現
- エラー契約: 認可(未認証・Profile 権限なし)、revision 競合、利用不可絵文字、不正入力(6 件以上・重複・不正識別子)、対象不存在、未実装(501)
- 再送の契約: 同一の PUT/DELETE の再実行結果(冪等性)と revision 競合時の扱いの定義
- 利用不可になった選択済み反応でも DELETE(解除)が可能であることの契約化
- 型・serialization・schema・fixture(0/5/6 件、重複、利用不可、再送・競合)と、全 route が 501 を返すテスト
- openapi/shuttlepub.json の再生成とコミット

## Out Of Scope

- 設定・reaction の実保存、DB、端末間同期の実処理、投稿処理(Note への実反応付与)
- 認証基盤の実装(契約上の認可エラー表現のみ)
- 既存 dev API POST /api/notes/{id}/reactions の変更・削除・生成 schema への掲載
- D05 の履歴 ON/OFF、D13 の設定など他機能の設定を同じ API に載せること
- 異なる Profile 間・Account 全体での設定共有
- frontends の UI・mock 実装

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の /api/v1 に、Profile の常用絵文字設定(GET/PUT、最大 5 件・一意・revision)と Profile×投稿の reaction(GET/PUT/DELETE)の契約を、型・OpenAPI schema・fixture・501 route として追加し、生成 schema を更新すること。実保存・同期・投稿処理は実装せず、契約外の dev API は schema に載せない。S0 の再生成差分 CI を含む既存 CI がグリーンであること。

## Acceptance Criteria

- Profile 設定の GET/PUT 契約: 順序付き常用絵文字(0〜最大5件)、一意性、revision による競合検出が型と schema で表現される
- Profile×投稿の reaction GET/PUT/DELETE 契約: 未反応・選択済み・置換・解除の状態が表現され、1 Profile・1 投稿・1 反応を契約で保証する
- 絵文字は Unicode と custom emoji を識別でき、各絵文字の利用可否(利用不可)を応答で表現できる
- 認可エラー・revision 競合・利用不可・不正入力(6 件以上・重複)・再送(同一リクエストの再実行)の結果が schema と fixture で定義される
- 利用不可になった選択済み反応でも DELETE(解除)が成立する契約になっている
- 全 route が明示的な 501(共通エラー形式)を返し、既存 dev API はこの契約・生成 schema に含まれない
- 生成 schema(openapi/shuttlepub.json)が更新され、S0 の再生成差分 CI がグリーン

## Verification

- 型・serialization テスト(Unicode / custom emoji、0・5・6 件、重複、revision)
- schema テスト(生成 schema が契約と一致し、既存 dev API を含まないこと)と再生成差分なし
- fixture 検証(0 / 5 / 6 件、重複、利用不可、再送、revision 競合、利用不可の選択済み反応の DELETE)を schema に照合
- 全契約 route が明示的な 501(共通エラー形式)を返す route テスト
- 既存 Rust CI(fmt / clippy -D warnings / test / build / git diff --check)がグリーン

## Related Links

- 先行ユニット: shuttlepub-openapi-foundation(ShuttlePub/ShuttlePub#14、ShuttlePub/ShuttlePub)
- 後続ユニット: quick-reaction-web-ui(ShuttlePub/shuttlepub-frontends、本契約に準拠する mock を使う)
- 意図: intents/shuttlepub/product/social-experience.md (I03)、intents/shuttlepub/packets/candidates.md (D03)
- 決定記録: intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d03-q01〜q07、q06 は訂正版)

## Knowledge Maintenance

- Intent placement: social-experience.md I03 節と candidates.md D03 節に S3 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: D03 に「API 契約のみ、保存未実装」と dev API(POST /api/notes/{id}/reactions)との関係を記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
