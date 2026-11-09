# quick-reaction-api-contract Implementation Packet

## Goal

ShuttlePub の /api/v1 に、クイックリアクション用の API 契約を定義する。(1) Profile 単位の常用絵文字設定(順序付き最大5件・一意・revision)の GET/PUT、(2) Profile×投稿の reaction の GET/PUT/DELETE を、型・serialization・生成 OpenAPI schema・fixture として確定させる。実保存・端末間同期の実処理・投稿処理は実装せず、route は明示的な 501 を返す。frontends の UI とステートフル mock が準拠する producer 契約になる。

## Why

UI を先行させる方針のもと、ShuttlePub backend 実装を待たずに frontends がクイックリアクション UI を作れるよう、先に API 契約を固定する必要がある。常用絵文字設定の保存先を ShuttlePub backend の Profile 単位に置く決定(d03-q07)は済んでいるが、具体的な API 契約は未定義。S0 の OpenAPI 基盤ができ次第、その上に載せる最初の業務契約になる。

## Scope

- Profile 設定 GET/PUT: 順序付き常用絵文字(0〜5 件)、一意性、revision(楽観的競合検出)、各絵文字の利用可否表現
- Profile×投稿 reaction GET/PUT/DELETE: 未反応・選択済み・置換(別絵文字での PUT)・解除。1 Profile・1 投稿・1 反応
- 絵文字識別: Unicode 絵文字と custom emoji の識別子表現、利用可能性(利用不可)の表現
- エラー契約: 認可(未認証・Profile 権限なし)、revision 競合、利用不可絵文字、不正入力(6 件以上・重複・不正識別子)、対象不存在、未実装(501)
- 再送の契約: 同一の PUT/DELETE の再実行結果(冪等性)と revision 競合時の扱いの定義
- 利用不可になった選択済み反応でも DELETE(解除)が可能であることの契約化
- 型・serialization・schema・fixture(0/5/6 件、重複、利用不可、再送・競合)と、全 route が 501 を返すテスト
- openapi/shuttlepub.json の再生成とコミット

## Out of scope

- 設定・reaction の実保存、DB、端末間同期の実処理、投稿処理(Note への実反応付与)
- 認証基盤の実装(契約上の認可エラー表現のみ)
- 既存 dev API POST /api/notes/{id}/reactions の変更・削除・生成 schema への掲載
- D05 の履歴 ON/OFF、D13 の設定など他機能の設定を同じ API に載せること
- 異なる Profile 間・Account 全体での設定共有
- frontends の UI・mock 実装

## Design notes

- PUT/DELETE の再送は冪等に定義する(同一内容の再実行は同一結果。DELETE は未反応でも成功扱いにするか否かを明示し fixture 化)
- 利用可否(利用不可)は応答に含めるが、DELETE の成否は利用可否に依存させない
- revision 競合は専用エラーで表現し、競合時に現在の revision を返す
- reaction の置換(別絵文字での PUT)は API 契約としては定義するが、UI は解除後にピッカーで選ぶ運用(UI からの直接置換は提供しない)

## Verification

- 型・serialization テスト(Unicode / custom emoji、0・5・6 件、重複、revision)
- schema テスト(生成 schema が契約と一致し、既存 dev API を含まないこと)と再生成差分なし
- fixture 検証(0 / 5 / 6 件、重複、利用不可、再送、revision 競合、利用不可の選択済み反応の DELETE)を schema に照合
- 全契約 route が明示的な 501(共通エラー形式)を返す route テスト
- 既存 Rust CI(fmt / clippy -D warnings / test / build / git diff --check)がグリーン

## Knowledge Maintenance (G461)

- Intent placement: social-experience.md I03 節と candidates.md D03 節に S3 の unit・依存・到達範囲を追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う)
- Diagram candidate: none
- Docs update: D03 に「API 契約のみ、保存未実装」と dev API(POST /api/notes/{id}/reactions)との関係を記録
- Closeout writeback expected: yes
