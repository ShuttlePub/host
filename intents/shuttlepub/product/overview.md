# Product Overview

## これは何か

ShuttlePub サービス群の SNS 本体 (タイムライン構築・投稿永続化) を目指す
リポジトリ。ただし現状コードは 2023-04-30 を最後に停滞しており、
Account / Profile / Follow の CRUD 土台と未実装の signup/login エンドポイント
のみが存在する。以下は現状の観察整理 (評価ではない)。

## ユーザー

現行コード上は未定義。サービス群の intent 記録 (emumet) では、ShuttlePub
利用者・サービス間クライアント・インスタンス管理者・外部 ActivityPub
サーバーがサービス群全体のユーザーとして整理されているが、ShuttlePub
リポジトリ固有の記録はまだない。

## 現状 (2026-08-29 時点の実装インベントリ、base = d857781)

実装が確認できる範囲:

- **Account CRUD 土台**: kernel entity (id: i64 ランダム生成、name、bot 旗、
  作成/更新時刻)、repository trait、postgres 実装、Create/Delete インタラクタ。
- **Profile 作成・更新**: display_name / summary / icon / banner を持つ
  profile エンティティ + postgres 実装。
- **Follow**: kernel に repository trait (add / remove / find_all_by_src /
  find_all_by_local) のみ存在。driver に postgres 実装はなく、呼び出し元も
  ない (未完の土台)。
- **REST エンドポイント**: `/v0/account/signup` `/v0/account/login` の
  2 つのみ。ハンドラは両方 `todo!()` で、どのインタラクタとも接続されていない
  (di.rs はインタラクタを生成するが変数に束縛するだけで破棄)。

未実装 (スキーマのみ、または記録なし):

- 投稿 (Note) 系の Rust 実装は一切ない。migration 内の notes / note_media /
  note_reaction / note_reply / note_mention / note_turbo_quote / note_turbo /
  reaction_asset / hashtags 各テーブルに対応するコードが存在しない。
- タイムライン機能なし。
- ActivityPub 連合機能なし (WebFinger/Inbox/Outbox などいずれもなし)。
- Emumet / Ory / Booskiff との連携なし。
- メディア処理なし (kernel に image クレート依存はあるが使用箇所なし)。

## Non-goals

現行コードベースが「連合を意識した単体 SNS」として設計されていた名残は
ある (remote 宛先カラム、独自認証テーブル) が、サービス群の現行 intent
記録では以下は ShuttlePub 本体の Non-goal として emumet / booskiff 側に
責務が置かれている:

- アカウント・署名鍵・連合中継 → Emumet
- 認証・認可基盤 → Ory (Kratos/Hydra)
- ファイル保管 → Booskiff

※ 現状コードがこの Non-goal 構成に追随するかは本ドメインの今後の
shaping 対象。ここでは記録のみ。
