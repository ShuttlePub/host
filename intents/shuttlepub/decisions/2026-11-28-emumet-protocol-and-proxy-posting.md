# 2026-11-28 Emumet Protocol・代理投稿の最小の流れ・Emumet のモック (D72-D76)

2026-11-27〜28 に operator (ShuttlePub 本体の担当) と設計席の間で確定した決定。
[2026-11-22-shared-inbox-and-link-permissions.md](2026-11-22-shared-inbox-and-link-permissions.md) (D71) の続きで、番号を引き継ぐ。

## きっかけ

`shuttlepub-producer-intake` (PR #35) を `dev` に merge したあと、D70 に従って次の単位を切るために、
Emumet の転送の契約と実装を調べた (2026-11-27、Emumet `main` = `439f747`)。分かったこと:

- 契約 v1 (revision 3) と Emumet の送信側は一致している。D71 (宛先一覧、Shared Inbox) は、契約・fixture・
  Emumet のコードのどこにも反映されていない。
- Emumet に署名 API はない (旧 `/internal/v1/accounts/{id}/sign` は 410 で廃止済み。backlog では P2/P3)。
- nitinol 0.9.0 (2026-11-25) で、集約と Projector の idle timeout の指定と、止まった Projector を
  追記で起こし直す仕組みが入った。

operator の整理: 作るべきは「代理投稿」と「代理受信」で、代理投稿の途中に「送る本体への Emumet の代理署名」が
要る。Emumet 側の実装を待たずに確かめられる形で、最小限から進める。

## 決定

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D72 | 呼び方と unstable の印 | Emumet と ShuttlePub の間の転送部分を「Emumet Protocol」と呼ぶ (それまでの「内向き転送」「post-relay」)。D71 を反映する改訂は v2 として起こさず、unstable と明示する。ShuttlePub が Emumet に求める新しい API は、経路に `unstable` を入れる (`/internal/unstable/emumet/...`)。既存の契約 v1 (`contracts/emumet-post-relay/`) の本文と経路は、この決定では変えない。受信側に同じ印をどう付けるかは、受信の単位で決める | 確定 |
| D73 | 代理投稿から始める | D70 (4) の「P1 の最初の実行単位は ③ の受け口」より前に、代理投稿 (この ShuttlePub の利用者の投稿を、Emumet の代理署名を付けて相手の inbox へ届ける) を最小の形で通す。代理受信 (Emumet Protocol の受け口) はその次。D70 のほかの部分 (リレーを初期の範囲から外す、system.actor、Global TL) は変えない | 確定 |
| D74 | 代理投稿の最小の流れ | (1) 投稿の集約が「投稿した」を記録し、利用者への応答は配送を待たない。(2) Projector がその出来事を読み、Activity を 1 回だけ JSON にする。(3) 送る直前に、本体と宛先の inbox URL を Emumet に渡して署名を頼む。(4) 返ってきたヘッダと本体を変えずに POST する。(5) 結果を出来事として記録する。別のキュー製品は使わず、nitinol のイベントストアと Projector の位置をキューとして使う。署名は保存せず、失敗したら (3) からやり直す。最小版で削るもの: 認証は OAuth を使わず、ShuttlePub が自分の鍵で要求に HTTP 署名し、Emumet は設定で許可した origin か確かめる。宛先は Activity の `to`・`cc` から決まる相手だけ (フォロワーへの配送は後)。再試行はその場の数回だけで、だめなら「届かなかった」と記録して次へ進む。署名は宛先 1 件ずつ頼む。型は Create (Note) だけ。投稿の入口には利用者の認証を置かず、設定で決めた 1 つの Profile として投稿する | 確定 |
| D75 | Emumet のモック | ShuttlePub のリポジトリに、Emumet が提供すべき API を ShuttlePub 自身でまねる専用の crate (`shuttlepub-emumet-mock`、lib と bin) を置く。本番の 5 crate からは依存せず、`server` のテストが dev-dependency として使う。モックを使うかどうかは Emumet の URL の設定だけで決まり、本番のコードに `cfg` を入れない。cargo の feature にしないのは、品質ゲートが `--all-features` で動くので「付けたときだけ有効」を検査で区別できないため (D49 の補足と同じ理由)。最初にまねるのは、代理署名 (`POST /internal/unstable/emumet/sign`) と Profile の actor 文書 (`GET /ap/profiles/{id}`)。受信側 (Emumet Protocol で転送してくる役) は代理投稿が通ってから足す | 確定 |
| D76 | 実行単位の順 | (1) 土台の更新: nitinol 0.9.0、idle timeout、テストの PostgreSQL をプロセスをまたいで共有する。(2) 代理投稿: モックの crate、代理署名の口 (`port`) と実装 (`driver`)、投稿の入口、投稿の集約、配送の Projector。リレー用の部分 (`POST /inbox`、供給元の集約、Accept の配送) は (2) で外す。先に外すと、署名の検証と投稿の集約が呼び出し元のないコードになるため | 確定 |

## 代理署名の API (unstable、草案)

Emumet 側の実装の基準になる。(2) の単位の設計で契約として `contracts/` に置く。

```
POST {emumet}/internal/unstable/emumet/sign
認証: ShuttlePub の鍵による HTTP 署名

要求
{
  "profile_actor": "https://emumet.example/ap/profiles/abc",
  "link_id": "lnk_...",
  "body": "<送る Activity のバイト列を Base64>",
  "inboxes": ["https://remote.example/inbox"]
}

応答 200
{
  "results": [
    { "inbox": "https://remote.example/inbox",
      "headers": [ {"name": "Date", "value": "..."},
                   {"name": "Digest", "value": "..."},
                   {"name": "Signature", "value": "..."} ] },
    { "inbox": "https://other.example/inbox", "error": "inbox_not_allowed" }
  ]
}
```

- ShuttlePub は `headers` を解釈せず、そのまま付けて送る。署名方式 (署名対象の組など) は Emumet が決める。
- 要求全体の拒否 (認証の失敗、`actor` の不一致、許可外の型) は 4xx で、配送を打ち切る。5xx は再試行。
- 宛先は配列。最小版は 1 件ずつ呼ぶが、まとめるときに形を変えない (D57)。
- モックが確かめるのは、`actor` が `profile_actor` と一致することと、`id` が `link_id` の名前空間にあること (ADR 0003)。

## 今回の決定に含めないもの (未決)

- **時間を置いた再試行**。Projector は出来事を順に処理するので、1 件の再試行を長く続けると後ろの配送が止まる。
  配送 1 件ごとに状態を持つ仕組みが要る (`nitinol-saga` が候補。中身は未確認)。
- **フォロワーへの配送**。宛先の一覧は Emumet が正本で、その API (D58) は未実装。
- **link の ID の入手**。投稿の `id` に入れる `link-id` を、設定値で渡すか Emumet に問い合わせるか。(2) の単位で決める。
- **Emumet Protocol の受信側の改訂** (D71)。宛先一覧の形、Shared Inbox のときの扱い、unstable の印の付け方。
- **Emumet 側の実装**。署名 API と、D71 の反映。Emumet の担当と調整する。

## 過去の決定との関係

- **D70 (4)** (P1 の最初の実行単位は ③ の受け口): D73 で、代理投稿をその前に置く。受け口はその次。
- **D71** (転送の契約を P1 のうちに改める): 改め方は D72 で「v2 ではなく unstable」とした。中身は未決のまま。
- **D27・D33・D57、emumet ADR 0003** (署名は Emumet、配送は ShuttlePub、宛先ごと・試行ごとに署名): 維持。
  D74 はその最小の形。ADR 0003 の link capability (`sign:post`) と DCR による認可は、最小版では使わない。
- **D49 の補足** (ストアを切り替える feature を作らない): D75 は同じ理由でモックを feature にしない。
- **D51** (Emumet → ShuttlePub はサーバー鍵の署名): D74 の認証は、逆向きに同じ考え方を使う。

## 作業の記録

- `shuttlepub-producer-intake` (PR #35、Issue #34) は 2026-11-23 に `dev` へ merge し、closeout した
  (`dev` = `efb5bfc`)。D70 の「packet は queued (未公開) のまま」は、記録の時点で実際の状態とずれていた
  ([00-map.md](../intent-tree/00-map.md) に補足)。
- Emumet の調査の要点: 外側の署名は draft-cavage の `rsa-sha256` で、署名対象は
  `(request-target) host date digest` の 4 つちょうど。instance actor (`/ap/instance`) は `inbox` がなく
  `publicKey` が配列。ShuttlePub の既存の検証器 (5 つの署名対象が必須) と actor の取得 (`inbox` が必須) は、
  そのままでは使えない。受信の単位の設計で扱う。
