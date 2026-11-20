---
facets: [vocabulary, invariant]
---

# ShuttlePub サービス群のコンセプト

2026-11-18 確定 (decisions/2026-11-18-service-concept-and-cross-service-p0.md の D23-D35)。
サービス群全体のコンセプトを記録する場所がなかったため、`shuttlepub` ドメインに置く。
Emumet・Booskiff の mission はここを参照する。

2026-11-20 追記 (decisions/2026-11-20-problem-domain-and-producers.md の D42-D49):
ShuttlePub の問題領域を「Producer から送られた Activity を元にタイムラインを構築すること」と
定めた。下の「コミュニティ TL」は Local TL と呼ぶ (D45)。外から届いたただの Note は
Global TL に流す方針。

## 一文で

**1 つのアカウントで、たくさんの小さなタイムラインを渡り歩ける Fediverse。**

## 柱

1. **住所と本体の分離** — アカウント (acct・鍵・フォロワー) は Emumet、
   タイムライン (コミュニティ) は ShuttlePub が持つ。
2. **小さなタイムラインを多数** — ShuttlePub は 1 サーバー = 1 コミュニティ。
   Misskey の channel のような小さなタイムラインを、サーバーを分けることで
   いくつも持てる。ShuttlePub の中にさらに細かいコミュニティは作らない。
3. **単一アカウントでコミュニティを往来** — コミュニティごとにアカウントを作らなくてよい。
   投稿の届け先 (コミュニティ内だけ / フォロワーにも など) は投稿ごとに選ぶ。
4. **ホームは 1 つ** — Profile ごとにホームの ShuttlePub を 1 つ決め、そこがホーム TL と
   自分宛ての投稿の受け取りを持つ。ほかのコミュニティには「参加」する。
5. **部分的なセルフホスト** — Emumet・ShuttlePub・Booskiff をそれぞれ公式でも自前でも
   組み合わせられる。特に「Emumet だけ自前で、公式の大きなタイムラインに参加する」は
   この構成でしかできない強み。

## 各サービスの役割

| サービス | 役割 | 持つもの |
|---|---|---|
| Emumet | Identity Plane | アカウントの正本、acct (= Emumet ドメイン)、Profile (= AP actor)、署名鍵、フォロワーグラフ、link (Profile のアタッチ先) |
| ShuttlePub | コミュニティそのもの | コミュニティ TL・ホーム TL、投稿と反応の永続化、配送 (fan-out・再送)、連合先に公開するリレー用 inbox と Emumet からの転送を受ける専用 API (D39)、検索・通知 |
| Booskiff | ドライブ | ファイル (画像中心)、課金 (サービス群で唯一の課金ポイント) |
| Ory (Kratos / Hydra) | 認証・認可 | ログイン、OAuth2 / OIDC、サービス間のクライアント登録 (DCR) |
| Stellar (P1 の後に切り出す、D37) | 薄い認証サービス | Ory の上に載る。初期スコープの候補はログイン・同意のコールバックと DCR の受付 |
| shuttlepub-frontends | 画面 | shuttlepub-web (SNS)、emumet-web (アカウント管理) |

## 投稿の流れ

- 投稿の actor は Emumet の Profile。ShuttlePub が Activity を組み立て、
  Emumet の署名 API で宛先ごとに署名してもらい、ShuttlePub が配送する。
  鍵は Emumet から出ない。
- Activity / Note の ID は Emumet ドメインの link ごとの名前空間
  (`https://<emumet>/objects/<link-id>/<local-id>`)。その URL への GET は、
  Emumet が発行元の ShuttlePub へ透過プロキシする。
- 外部から Profile に届いた Activity は、Emumet が受けて専用 API でホーム
  (および信頼モード②以上の link) の ShuttlePub へ転送する。
- コミュニティ内だけの投稿は AP で配送せず、その ShuttlePub の中で完結する。

## link と信頼モード

link は「Profile のアタッチ先」(Profile がどの ShuttlePub サーバーにアタッチしているか)
を表す (説明の言葉は当面これに揃える、D40)。別のサーバーを閲覧しても link は変わらない。
ShuttlePub のドメインが変わる場合は、新しいサーバーとして扱う。
Profile は ShuttlePub ごとに link を持ち、Emumet が発行する。
登録は本人が UI の認可確認画面で行い、link ごとに信頼モードを選ぶ。

| モード | できること | 数 |
|---|---|---|
| ① 署名のみ | その ShuttlePub で投稿できる (`sign:post`) | 複数可 |
| ② 受信の転送 | ① + Profile 宛ての Activity を受け取る | 複数可 |
| ③ コレクション配布 | ② + outbox など Profile のコレクションを配る = ホーム | 同時に 1 つ |

## 公開範囲

公開 / 未収載 / フォロワー / ダイレクト (Mastodon の 4 種) + コミュニティ内。

## CQRS+ES とスケール

- AP のペイロードはイベントそのものなので、イベントソーシングと素直に対応する。
- 同じ投稿イベントから、コミュニティ TL・ホーム TL・検索・通知という複数の射影を作る。
  公開範囲は「どの射影に流すか」で表せる。
- 公式 ShuttlePub は大きな TL、コミュニティの ShuttlePub は小さく気軽に立てたい。
  同じソフトウェアが小さくも大きくも動くことを要件とする。

## 構想

- 小さな ShuttlePub を少額で気軽に立てられるホスティングサービス。
