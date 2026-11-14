# note-search-author-lookup-api-contract Implementation Packet

## Goal

ShuttlePub の /api/v1 に、投稿検索(D04)の作者指定を補助する 2 operation(`resolveNoteSearchAuthor`: acct→作者の特定、`suggestNoteSearchAuthors`: 入力中の作者候補 最大 5 件)の契約を、UI 先行で型・入力検査・utoipa・生成 OpenAPI・fixture・明示的な 501 スタブとして固定する。実処理と外部照会は実装しない(外部照会は契約が禁止する)。

## Why

D04 の検索 UI は `from:@acct` を投稿者チップへ変換し、入力中に候補を出す。#23 の `searchPersonalNotes` は actor ID URL しか受けず、acct の解決と候補の API が無い。ユーザー決定(d04-q13〜q15、原文「A,Bは推奨で」「Cはbで」)で範囲が決まったため、frontends が準拠できるよう契約を先に確定する。

## Scope

- server 層のみ。新規 `server/src/api_v1/search_author.rs`、`server/src/api_v1.rs` の登録と ErrorCode 追加、必要なら `server/src/openapi.rs`、`openapi/shuttlepub.json` 再生成、server テスト・fixture・契約文書(`server/docs/note-search-author-lookup-contract.md`)
- 2 operation(`.../search/authors/resolve`、`.../search/authors/suggestions`)、bearer_auth 必須、handler は extractor なしで常に 501
- 入力検査の純粋関数(acct / prefix)と照合用の正規化(NFKC＋小文字化。返却表記は保持)、閉じた応答 schema、エラー契約(429 rate_limited / 503 author_lookup_timeout・author_lookup_unavailable を ErrorCode に追加)
- 対象集合(取得済み・公開参照可能・ミュート/ブロック除外)と非外部照会を契約文書と schema 説明に明記
- 判断(packet 時の設計): ①acct の host を自サーバーの host と同一に指定した場合は host 省略と同じ(自サーバーの確定 username)。応答の `acct` は常に `user@host`(自サーバーの作者も自サーバーの host 付き)。suggestions が返す remote 作者の acct は表示用で未検証でありうるため、選んだ候補は `actor_url` で識別し acct の再 resolve に依存しない。②resolve は明示指定のためミュート/ブロック除外を適用しない(候補ではないため。除外は suggestions のみ)。その後の検索は #23 の規則(domain の mute/block は空結果の 200)。③acct の host にポートは含められない(`:` は URL 構文として拒否)。④prefix は表示名の空白を許すため制御文字・U+FFFD のみ拒否する。⑤照合用の NFKC のため server に `icu_normalizer`(default-features なし、既に `Cargo.lock` にある crate)を追加する(DB・HTTP・非同期の依存ではない)

## Out of scope

- 実処理(取得済み作者集合の参照・Emumet からの外部取得を誘発しない read-only 連携・検証済み remote acct 対応の保存と供給)は後続 unit
- 外部照会(WebFinger・actor 取得)。将来の仕様変更候補
- DB・HTTP・バックグラウンド取得・認証サービスへの依存、kernel / application / driver / migration、Emumet、frontends(schema pin・画面。remote icon の IP 漏洩は frontends の画像ポリシー)
- #23 `searchPersonalNotes` など既存契約の変更

## Verification

- 純粋関数・schema fixture(正負)・test-only 参照投影・両 route 501・router/schema 単一登録と決定性・既存回帰のテスト
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)と openapi 再生成差分 CI がグリーン

## Knowledge Maintenance (G461, optional)

- Intent placement: social-experience.md I04 と candidates.md D04 に到達範囲・残余を追記(決定自体は着手前に host c59a192 で記録済み)。新規ノード不要
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う。決定は d04-q13〜q15 に記録済み)
- Diagram candidate: none
- Docs update: D04 / I04 に「API 契約のみ」と残余を記録
- Closeout learning: 解決根拠と非外部照会、共有表示キャッシュを使わない漏洩防止、host 省略は自サーバー、エラーを 0 件・不在に変換しない契約、resolve が mute/block を除外しない判断を記録(`write_back_required: true`)
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation / ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`)

## Revision history

- 2026-11-14: 初版(ユーザー決定 d04-q13〜q15 を反映)。
- 2026-11-14 (実装時の整合、ShuttlePub PR #27): 上記判断③⑤を追記(suggestions の acct は表示用で再 resolve に依存しない、`icu_normalizer` の追加)。issue 本文と packet.yaml の受け入れ基準は不変。
