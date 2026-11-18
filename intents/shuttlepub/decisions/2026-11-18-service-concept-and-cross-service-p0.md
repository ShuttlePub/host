# 2026-11-18 サービス群のコンセプトとサービス間の前提 (D23-D35)

2026-11-17〜18 に operator と Excalidraw 上で行った議論で確定した決定。
[2026-11-16-relay-first-and-module-slicing.md](2026-11-16-relay-first-and-module-slicing.md)
の続きで、番号を引き継ぐ。

きっかけは operator の問題提起「ShuttlePub がただのリレーサーバーと化している。
CQRS+ES などの設計やスケールの構想が死にかけているのは、コンセプトが曖昧だから
ではないか」。サービス群全体のコンセプトを先に定め、そこから ShuttlePub の位置付けと、
Emumet・Booskiff と合わせて動かすための前提 (ロードマップの P0) を決めた。

コンセプトの全体像は [../product/service-concept.md](../product/service-concept.md)、
実装の順序は [../packets/roadmap-2026-11-18.md](../packets/roadmap-2026-11-18.md)。

## サービス群のコンセプト

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D23 | コンセプトの軸 | 「1 つの Emumet アカウントで、たくさんの小さなタイムラインを渡り歩ける Fediverse」。もう 1 つの軸は部分的なセルフホストで、例えば Emumet だけを自分で立てて公式の ShuttlePub に参加できる (この構成でしかできない強み) | 確定 |
| D24 | コミュニティの単位 | ShuttlePub は 1 サーバー = 1 コミュニティ。コミュニティ TL = その ShuttlePub の TL。ShuttlePub の中にさらに細かいコミュニティ TL は作らない。分けたい場合は別の ShuttlePub を立てる。ユーザーが作るリストによる TL (フィルタ) は許容する | 確定 |
| D25 | コミュニティの actor | ShuttlePub のシステム actor (現在の `/actor`) をコミュニティの actor とする。Group actor は別に立てない | 確定 |
| D26 | ホーム | Profile ごとにホームの ShuttlePub を 1 つ持つ。ホームはホーム TL (フォローしている人の投稿) を構築し、自分宛ての投稿を受け取る。ほかのコミュニティには「参加」する | 確定 |
| D27 | 投稿の actor・署名・配送 | 投稿の actor は Emumet の Profile (acct = Emumet ドメイン)。署名は Emumet が行い、鍵は Emumet から出さない。配送 (fan-out・再送) は ShuttlePub が行う (emumet ADR 0003 と一致)。例外として Follow / Accept / Block などは Emumet 自身が配送する | 確定 |
| D28 | 公開範囲 | 投稿ごとに選ぶ。種類は 公開 / 未収載 / フォロワー / ダイレクト (Mastodon の 4 種) + コミュニティ内。コミュニティ内の投稿は AP で配送せず ShuttlePub の中で完結させる。ただし ID は最初から Emumet の link 名前空間で振る (あとで公開範囲を広げられるように) | 確定 |
| D29 | ShuttlePub の位置付け | ShuttlePub は「コミュニティそのもの」。リレー (連合の受け口と配送) はその部品の 1 つで、正体ではない。CQRS+ES を使う理由は、AP のペイロード自体がイベント (Create / Follow / Like / Announce / Undo …) で CRUD より素直に対応づけられること、同じ投稿イベントからコミュニティ TL・ホーム TL・検索・通知という複数の射影を作れること。スケールについては、公式 ShuttlePub は大きな TL になり、コミュニティの ShuttlePub は小さく気軽に立てたいので、同じソフトウェアが小さくも大きくも動くことを要件とする | 確定 |

## サービス間の前提 (ロードマップ P0)

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D30 | Emumet → ShuttlePub の内向き転送 (emumet C2) | 専用 API とする (Emumet が受けたものをホームへ回すのは AP のサーバー間配送の範囲外。FEP-ef61 も対象が違う)。中身は受信した AP の Activity をそのまま渡し、外側に宛先 Profile・署名検証の結果・受信時刻などを付ける。再送の値は 2026-08-25 の決定 (初回 30 秒・倍率 2・上限 1 時間・72 時間で打ち切り) を使う | 確定 |
| D31 | link の分け方 (emumet C3) | link を「ホームの link」と「参加の link」に分ける。参加の link は複数持てる。登録は本人が UI から行う (認可の確認画面)。link ごとに信頼モードを選ぶ: ① 署名のみ、② ① + 受信の転送、③ ② + Profile のコレクション配布。③ を持てるのは同時に 1 つで、それがホーム。② は複数の link が持てる。ダイレクトをどの link へ転送するかは shuttlepub-link の設計で決める | 確定 |
| D32 | サービス間認証 | Hydra を使っている間は Dynamic Client Registration (DCR)。Emumet は client_id と ShuttlePub の origin の対応を持つ。将来 Stellar を Hydra の上に載せて OpenID Federation を使うときは、client_id が Entity ID (URL) に変わるので、この対応を使って付け替える | 確定 (対応表の担当は [D36-D41](2026-11-18-p1-first-and-stellar-carve-out.md) で未決に戻した) |
| D33 | 署名 API | emumet の reset ADR §5 が禁じるのは「汎用の Profile 署名 API」で、ADR 0003 の狭い署名 API (capability で認可し、宛先ごとに署名する) は別物として扱う。さらにバッチ化を認める: 1 回の呼び出しで inbox URL の並びを受け、宛先ごとの署名済みヘッダをまとめて返す。宛先は相手の sharedInbox を優先し、なければ個別の inbox とし、inbox URL で重複を除く (sharedInbox を持たない実装があるため) | 確定 |
| D34 | `/api/v1` 契約の追加と merge | 投稿作成・コミュニティ TL・公開範囲は P2 の実行単位で `/api/v1` に足す。dev で契約に差分が出ても、frontends の schema pin を更新する前提で main に merge してよい (D19 の未決を解消) | 確定 |
| D35 | 連合 E2E とイメージ公開 | 連合 E2E (Emumet・ShuttlePub・相手の実装をまとめて動かすテスト) は専用の repo に置く。各サービスのイメージ公開は P1 で整える。リリース用の main とは別に dev からもイメージを公開し、タグは「コミット SHA」と「dev」の 2 つとする。PR での E2E は SHA で固定し、定期実行は dev の最新を使う | 確定 |

## 方針だけ決めて確認を残すもの

- **httpsig と origin**: Mastodon / Misskey は送信元のホスト・IP と署名者のドメインを
  照合しない (emumet ADR 0003 の 2026-08-24 調査)。厳しいのは object ID のホスト
  (= actor のホスト = Emumet) で、link の名前空間と透過プロキシで満たす設計になっている。
  それ以外の実装 (GoToSocial・Akkoma・Lemmy など) は未確認で、ShuttlePub の実装が
  進み次第、連合 E2E の相手に入れて確かめる。
- **水平スケール**: セルフホストの k8s を前提に、最初は役割 (API / 配送 worker /
  射影 worker) ごとに固定の台数で立て、負荷試験で詰まる場所を測ってから自動化する。
  nitinol が複数プロセスで動くかの確認は ShuttlePub の実装が進んでから行い、
  負荷試験までに終える。
- **SLO**: 署名 API の SLO (p99 100ms) を含め、負荷試験を P1〜P3 のどこかに入れる。

## 構想 (未計画)

- 小さな ShuttlePub を少額で気軽に立てられるホスティングサービス (D24 の帰結)。

## 過去の決定との関係

- **D2・D13** (リレーは本体): 維持。D29 で、リレーは ShuttlePub の部品の 1 つという
  位置付けを加えた。
- **D21** (リレーとして動くことを優先): 実装順としては維持。ロードマップの P1 に当たる。
- **D3・D4 の注記** (当面、自前の鍵で署名): 自前の鍵で署名するのはシステム actor
  (= コミュニティの actor、D25) に限る。Profile の投稿は D27 のとおり Emumet が署名する。
  `shuttlepub-relay-follower` の「フォロワー」はシステム actor の購読者で、Profile の
  フォロワー (正本は Emumet、emumet ADR 0002) とは別物。
- **D19** (契約): 未決だった「dev で契約に差分が出た場合の main への merge」を D34 で解消。
- **emumet ADR 0002** の「1 Profile につき active な content link は 1 つ」: D31 で
  「信頼モード③ (ホーム) は同時に 1 つ」に読み替える。追記は emumet 側の ADR に記録した。
- **emumet ADR 0003**: D27 は 0003 と一致。D33 のバッチ化と §5 との関係は 0003 への追記として記録した。
- **emumet C2 / C3**: 再開条件 (ShuttlePub 本体の構想が立つこと) を満たしたので、
  方向を D30・D31 で確定した。詳細 (envelope の形、ダイレクトの振り分けなど) は
  post-relay / shuttlepub-link の実行単位の設計で決める。
