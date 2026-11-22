# 2026-11-20 ShuttlePub の問題領域と 3 つの Producer (D42-D50)

2026-11-19〜20 に operator と設計席 (本 domain の solo-conductor) の間で確定した決定。
[2026-11-18-p1-first-and-stellar-carve-out.md](2026-11-18-p1-first-and-stellar-carve-out.md)
の続きで、番号を引き継ぐ。

きっかけは `shuttlepub-relay-follower` (ShuttlePub/ShuttlePub #32、PR #33) の設計に対する
operator の指摘。

- 置き場所に困るものが現れている。サービスがドメインとして扱うべきものが無視されている。
- CRUD に寄っていて、nitinol の強みが出ていない。
- Migrator を細かく制御する理由はない。sqlx が用意している Migrator の例どおりにする。
- nitinol の System を driver で構築して包むのは位置が違う。nitinol に沿って永続化と
  リアクティブな ReadModel の導出を行うなら、そのまま AppHandler に EventSourceSystem が入る。

「問題領域を先に決めなければ、またただのリレーサーバーを作る」として、実行単位の前に
ShuttlePub が扱う問題領域を決めた。

## 決定

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D42 | 問題領域 | ShuttlePub が扱う問題は「Producer から送られた Activity を元に、タイムラインが構築されること」。永続化はその過程の一部で、目的ではない。Producer から Event Sourcing と Projector を使ってタイムラインを構築することが ShuttlePub の狙い | 確定 |
| D43 | 3 つの Producer | Activity を送ってくるものを 3 つと捉える。① ShuttlePub の利用者が投稿する (`/api/v1`)。② ShuttlePub の外から連合を申し込んできたサービスが、その公開投稿を送る (リレー用 inbox)。③ 外のサービスから Profile (Emumet) の inbox に届いたものが、ShuttlePub へ転送される (転送用の専用 API、D30・D39) | 確定 |
| D44 | リレーの位置付け | リレーサーバーの機能は「多数の投稿を受けるための仕組み」。D29 の「部品の 1 つ」をこの意味に定める。Follow は利用者から見れば購読だが、ソフトウェアから見れば Producer ② が 1 つ増えるという出来事として扱う。stargate の手動テストも、Misskey のリレー機能で Misskey のシステム actor から Follow を送ってもらい、stargate が静的に用意した relay actor から Accept を返す、という範囲だった。リレーの挙動を正しい意味にするための他サービスへの転送は領域に含めるが、実現は後でよい | 確定 |
| D45 | タイムラインの呼び方と流れ先 | 「コミュニティ TL」ではなく Local Timeline (Local TL) と呼ぶ。① の投稿は Local TL に流す。外から届いたただの Note は Global Timeline (Global TL) に流す。cc 付き、つまり返信などは、文脈を保つために Local TL に流してよい。③ で届いた Profile 宛てのものはホーム TL・通知に流す (D26) | 方針 (Global TL の扱いは実行単位の設計で確かめる) |
| D46 | アタッチの正本 | Profile がこのサーバーにアタッチしているか (link) は Emumet が持つ。ShuttlePub は自分のモデルとして記録せず、リクエストに付いてくる情報 (投稿時の認可、転送の envelope の宛先 Profile) か、Emumet への問い合わせで知る | 確定 |
| D47 | KJ法のまとまり | 3 つの Producer から起きる出来事を書き出して、まとめ直した。D20 の表 (2026-11-16 時点の A〜G) を下の表で置き換える。切り分け方そのもの (D20) と層の crate (D16) は維持する | 確定 |
| D48 | 最初の実行単位 | 「② の Producer を受け入れ、そこから届いた公開投稿を重複を除いて出来事として記録する」までを 1 つの単位にする。供給元の受け入れ → Accept の配送 (出来事への反応) → Activity の受け入れと重複の除去 → 投稿のイベントと通し、Emumet に依存しない。Global TL の読み出しと API は後のフェーズに置く (ロードマップの P2 以降)。`shuttlepub-relay-follower` (#32) は retired にし、PR #33 は merge せずに閉じた (2026-11-20)。新しい実行単位で作り直す | 方針 |
| D49 | nitinol の使い方 | nitinol の System は driver で構築して包まず、AppHandler が EventSourceSystem をそのまま持つ。書き込み側の仕事は「Activity を出来事として受け入れる (検証し、重複を除く)」で、タイムラインはすべて Projector が導く。マイグレーションは sqlx が用意している Migrator の例どおりに組む。外への配送 (Accept など) は出来事への反応として行う。nitinol は 0.8.0 を使う (nitinol-sqlx 0.7.0 が自分のマイグレーションを `nitinol_migrations` に記録するので、アプリケーションは `sqlx::migrate!()` をそのまま使える) | 方針 |
| D50 | port 層 | 層に `port` を足す (D16 の 4 crate を 5 crate にする)。集約の知識 (識別子など) は要るが、実体のほとんどが外部サービスであるものの口を置く。リモートの inbox への配送、リモート actor の取得、後には Emumet への署名依頼とアタッチの照会が入る。実装は driver が持ち、DI で渡す。出来事への反応 (Accept の配送など) は application に置く。saga は application 層の知識として扱い、反応の部品は Projector と同じ形で出来事を受け取って、port を呼ぶ | 確定 |

D49 への補足 (2026-11-20、operator): AppHandler にストアの型引数を付けない。付けると axum 側に
ストアの種類が出る。本番の AppHandler は nitinol の PostgreSQL プロバイダに固定する。検証で
ストアは層ごとに決める。`kernel` と `application` はインフラを使わないので、テストでは
`InMemoryStore` まで (`kernel` は純粋関数なのでストア自体が要らない)。`port`・`driver`・
`server` をテストするときは PostgreSQL を使う。feature flag で `server` のストアを切り替える
案は採らなかった。品質ゲートが `--all-features` で動くため、排他的な feature では PostgreSQL 側が
検査されなくなる。`shuttlepub-producer-intake` の packet は当初「ストアの違いは型引数で表す」と
していたので、この補足に合わせて直した。

D50 への補足 (2026-11-20、operator): `port` には抽象 (trait と `DependOn*`) だけを置き、
具象実装はすべて driver にまとめる。以後の packet と task の本文に明記する。

D45 への補足 (2026-11-22): 「cc 付き、つまり返信などは、文脈を保つために Local TL に流してよい」は
D69 ([2026-11-22-timeline-routing.md](2026-11-22-timeline-routing.md)) で置き換えた。Local TL に
並ぶのはこの ShuttlePub から投稿されたものだけで、外部から届いた返信は足さない。Global TL は
受け取った公開投稿をまとめて見せる。

D43 ②・D44・D48 への補足 (2026-11-22): D70 ([2026-11-22-initial-scope-without-relay.md](2026-11-22-initial-scope-without-relay.md))
で、Producer ② (取り込み) とリレーの再配信を初期の範囲から外し、P1 の最初の実行単位を ③ の転送の受け口に改めた。
Global TL は初期から ③ で転送された公開投稿で構成する。

## KJ法で得たまとまり (2026-11-20 時点、D47)

| まとまり | 入れた出来事 | 集約・射影の候補 |
|---|---|---|
| 供給元 | 連合の申し込みが届いた、受け入れた、取り消された | 集約: 供給元 (actor の ID) |
| 受け入れ | Activity が届いた、署名を確かめた、既に知っていた、受け入れた、拒んだ | 3 つの入口を 1 つの形にそろえる処理 |
| 投稿 | 書かれた、届いた、編集された、削除された、再共有された、反応が付いた、取り消された | 集約: 投稿 (object の ID) |
| タイムライン | Local TL・Global TL・ホーム TL に並んだ、通知ができた、検索できるようになった | Projector 群。流れ先を決める判断はここに置く |
| 配送 | Accept を届けた、投稿を宛先へ届けた、失敗して再試行した、打ち切った | 出来事への反応 |
| コミュニティ自身 | actor と鍵、設定 | — |
| 外への照会 | リモート actor の取得、Emumet への署名依頼とアタッチの照会 | 外部サービスへの口 |

D20 の表との違い:

- 「A. 連合の受け口と配送」を、供給元・受け入れ・配送に分けた。
- 「D. 読み出し」をタイムラインとし、流れ先を決める判断を含めて中核に置いた。
- 「F. 記録と実行の基盤」はまとまりから外した。nitinol の System は基盤として包まず、
  そのまま使う (D49)。
- 「G. 外部の身元」のうち自身の actor と鍵は「コミュニティ自身」に置く。PR #33 の
  `identity` という module 名は、Identity Plane (Emumet) と紛れるので使わない。

設計上の注意: 流れ先の判定に Emumet への問い合わせを使う場合、問い合わせは Projector の
中では行わない (同じイベントを再生しても同じタイムラインにならなくなる)。受け入れの時点で
問い合わせ、結果を「宛先のうち、このコミュニティにアタッチしている Profile」という事実として
イベントに記録し、Projector はその事実だけから流れ先を決める。

## 今回の決定に含めないもの (未決)

- **アタッチを問い合わせる口**。Emumet の `GET /api/v1/profiles/{profile_nanoid}`
  (ShuttlePub/Emumet 1259c73 の `server/src/route/profile_relationship.rs`) は、
  認可が Profile の現在の所有者の bearer token、キーが nanoid、応答に link を含まない。
  外から届いた Activity の cc にある actor の URL からアタッチを引くには、サービス間で
  使える口が要る。③ は envelope に宛先 Profile が付くので問い合わせは要らず、要るのは
  ② で届いた返信など。Emumet 側 (shuttlepub-link) への要望として扱う。
- **Global TL に流す範囲** (D45)。
- **重複の除去をどの集約が受け持つか**。候補は投稿の集約。実行単位の設計で確かめる。

## 過去の決定との関係

- **D16** (4 crate の層): `port` を足して 5 crate にする (D50)。依存の向きは
  application → port → kernel、driver → port・kernel、server → すべて。
- **D20** (KJ法による切り分け): 切り分け方は維持。2026-11-16 時点の表は D47 で置き換えた。
- **D21** (リレーとして動くことを優先、最初の集約はフォロワー): リレーの受け口から
  始める順序は維持。最初の単位は D48 のとおり、受けた投稿がタイムラインに並ぶところまでを
  含める。「フォロワー (購読者)」は「供給元 (Producer ②)」として扱う (D44)。
- **D24** (1 サーバー = 1 コミュニティ): 維持。「コミュニティ TL」という呼び方を
  D45 で Local TL に改める。
- **D29** (コミュニティそのもの、AP のペイロードはイベント): 維持。D42 で問題領域として
  言い直し、D44 でリレーの意味を定めた。
- **D36** (P1 の完了の目安「重複を除いて保存する」): 維持。保存は D42 のとおり過程の一部で、
  同じ受け入れの流れ (まとまり「受け入れ」) に ② と ③ が合流する。
- **ロードマップ** ([../packets/roadmap-2026-11-18.md](../packets/roadmap-2026-11-18.md)):
  P1 の `shuttlepub-relay-follower` の行に、作り直しの方針を追記した。
