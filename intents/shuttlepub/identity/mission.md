---
facets: [vocabulary]
---

# Mission

> Ask intent-cli for guidance before editing:
> `intent-cli guide intent-work setup --kind tree-layout --domain shuttlepub --format markdown`

## Mission statement

ShuttlePub サービス群における SNS 本体サービス。タイムライン構築と投稿コンテンツの
永続化を責務とし、アカウント・署名鍵・連合中継は Emumet、認証認可は Ory
(Kratos/Hydra)、ファイル保管は Booskiff に委譲する構成が、サービス群の現行
intent 記録 (emumet / booskiff) として確定している。

※ 上記はサービス群としての使命の記録。現状コードがこの構成を実現しているかは
別途「現状コードとの対応」に観察として整理する (乖離は事実の記録であり、
是正の指示ではない)。

## Vision

- ユーザーは Emumet アカウント (acct = Emumet ドメイン) でログインし、
  ShuttlePub 上でタイムラインを利用する (emumet intent より)。
- 本体サービスはタイムライン構築に集中し、連合プロトコル面の複雑さは
  Emumet に閉じ込められる (emumet intent より)。
- 投稿に添付するメディアは Booskiff 保管を前提とする (booskiff intent より)。

## Values / principles

- **責務の分離**: アカウント・鍵・連合中継は Emumet、認証認可は Ory、
  ファイルは Booskiff、タイムライン・投稿永続化は ShuttlePub 本体
  (emumet の Values より転記)。
- **連合ファースト**: ActivityPub 仕様との整合を優先する (emumet より転記)。

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
