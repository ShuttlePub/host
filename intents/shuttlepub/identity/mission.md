---
facets: [vocabulary]
---

# Mission

> Ask intent-cli for guidance before editing:
> `intent-cli guide intent-work setup --kind tree-layout --domain shuttlepub --format markdown`

## Mission statement

ShuttlePub サービス群における SNS 本体サービスで、**コミュニティそのもの**。
1 サーバー = 1 コミュニティ (小さなタイムライン) として、コミュニティ TL・ホーム TL の
構築、投稿と反応の永続化、配送、連合の受け口 (リレー) など、SNS として成り立たせる
部分を責務とする。リレーはその部品の 1 つで、正体ではない。大まかな指標として、
水平スケーリングの効果量が大きいものを ShuttlePub に置く。アカウント・署名鍵などの
Identity Plane は Emumet、認証認可は Ory (Kratos/Hydra)、ファイル保管は Booskiff に
委譲する。サービス群全体のコンセプトは [../product/service-concept.md](../product/service-concept.md)。

※ 2026-11-20 追記 (decisions/2026-11-20-problem-domain-and-producers.md の D42-D45)。
扱う問題領域は「Producer (利用者の投稿、連合を申し込んできた外のサービス、Emumet からの
転送) から送られた Activity を元に、タイムラインが構築されること」。永続化はその過程の
一部。リレーは多数の投稿を受けるための仕組み。「コミュニティ TL」は Local TL と呼ぶ。

※ 2026-11-18 改訂 (decisions/2026-11-18-service-concept-and-cross-service-p0.md の
D23-D29)。「コミュニティそのもの」という位置付けを加えた。

※ 2026-11-15 改訂 (decisions/2026-11-15-role-boundary-and-rebuild.md の
D12-D14)。旧記述は emumet intent からの転記で「連合中継は Emumet」として
いたが、誤りとして改めた。Emumet の中で inbox / outbox といった ActivityPub の
技術は現れるが、それはリレー機能ではない。

※ 上記はサービス群としての使命の記録。現状コードがこの構成を実現しているかは
別途「現状コードとの対応」に観察として整理する (乖離は事実の記録であり、
是正の指示ではない)。

## Vision

- ユーザーは Emumet アカウント (acct = Emumet ドメイン) でログインし、
  ShuttlePub 上でタイムラインを利用する (emumet intent より)。
- 1 つの Emumet アカウントで、たくさんの小さなタイムライン (ShuttlePub) を渡り歩ける。
  Profile ごとにホームの ShuttlePub を 1 つ持ち、ほかのコミュニティには参加する
  (2026-11-18 D23・D24・D26)。
- 部分的にセルフホストできる。例えば Emumet だけを自分で立てて、公式の ShuttlePub に
  参加できる (2026-11-18 D23)。
- 本体サービスはコミュニティ (タイムライン・投稿・配送) に集中し、
  アカウント・署名鍵など Identity に関わる複雑さは Emumet に閉じ込められる
  (2026-11-15 D12・D13 で改訂、2026-11-18 D29 で更新)。
- 投稿に添付するメディアは Booskiff 保管を前提とする (booskiff intent より)。

## Values / principles

- **責務の分離**: アカウント・鍵 (Identity Plane) は Emumet、認証認可は Ory、
  ファイルは Booskiff、リレー・タイムライン・投稿永続化は ShuttlePub 本体
  (emumet の Values からの転記を 2026-11-15 D12・D13 で改訂)。
- **連合ファースト**: ActivityPub 仕様との整合を優先する (emumet より転記)。
- **イベントとしての AP**: AP のペイロードはイベントそのものなので CQRS+ES で受け、
  同じイベントからコミュニティ TL・ホーム TL・検索・通知を射影する (2026-11-18 D29)。
- **小さくも大きくも動く**: 小さなコミュニティを気軽に立てられ、公式の大きな TL にも
  耐えられる同じソフトウェアにする (2026-11-18 D29)。

## 現状コードとの対応 (2026-08-29 観察、base = d857781, 2023-04-30)

現状のコードは上記構成とは独立した、独自アカウント管理を前提とした初期
スケルトンのまま停滞している。以下は観察事実の整理 (評価ではない)。

- **最終コミット 2023-04-30**。約 3 年 4 か月更新がない。
- Rust ワークスペース (kernel / application / driver / server、計約 1844 行)。
  クリーンアーキテク風の 4 クレート構成。
- **実装済みに見えるのは Account / Profile / Follow の CRUD 土台のみ**。
  kernel に Note / タイムライン / 連合関連のエンティティは存在しない。
- **Emumet / Ory / Booskiff との連携コードは一切存在しない**
  (依存にも名前がない)。現状コードはサービス群構成を前提としていない。
- 代わりに `confidentials` テーブル (address + pass) があり、
  独自のローカル認証を想定した構造が残っている。
- server の REST エンドポイントは `/v0/account/signup` `/v0/account/login`
  の 2 つのみで、両方ともハンドラは `todo!()`。
- migration は init (2023-02-16) の 1 つのみ。後半の notes / note_reply /
  note_mention / note_turbo_quote / note_turbo / note_reaction /
  reaction_asset / hashtags 各テーブルは **Rust コードに対応する実装がなく、
  スキーマのみ**。notes 定義は未定義カラム参照・後続テーブル先行参照・
  構文上不正な箇所 (hashtags の末尾カンマ) を含み、適用可否は未検証。
- driver の依存に redis (deadpool-redis) / meilisearch / lettre (メール) が
  宣言されているが、コードからは未使用。

## Glossary

- **ShuttlePub 本体**: タイムライン構築・投稿永続化を担うサービス。
  本ドメインの対象リポジトリ `ShuttlePub/ShuttlePub`。
- **turbo / turbo quote**: migration 上にのみ存在する概念。note_turbo /
  note_turbo_quote テーブルがあり、現行コード・現行 intent 記録のどちらにも
  定義がない (元の設計意図は未確認)。
- **confidentials**: 現行 migration が持つ認証情報テーブル (address, pass)。
  サービス群の現行方針 (Ory 委譲) とは別系統の構造。
