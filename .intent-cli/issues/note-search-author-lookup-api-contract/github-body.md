## Goal

ShuttlePub の /api/v1 に、投稿検索(D04)の作者指定を補助する 2 つの API の契約を確定させる: (1) 入力された acct(`@user@host`・`user@host`・host 省略の `user`)から作者を特定する `resolveNoteSearchAuthor`、(2) 入力中のアカウント候補を最大 5 件返す `suggestNoteSearchAuthors`。UI 先行で、server 層の型・入力検査・utoipa・生成 OpenAPI・fixture・明示的な 501 スタブだけを作り、実処理は実装しない。外部照会(WebFinger・actor 取得)は一切しないことを契約として固定する。

## Why This Slice Exists Now

D04 の検索 UI は `from:@acct` を投稿者チップへ自動変換し、入力中に候補を出す(ui-spec §2)。マージ済みの `searchPersonalNotes`(#23)は作者を actor ID URL でしか受けず、acct→actor ID の解決と候補の API は既存契約にない(#23 で BFF/UI または別 unit とした部分)。ユーザー決定(「@acct からその人を特定する API と、入力中のアカウント候補を出す API … この順番で進めてOK」、d04-q13〜q15)で、候補の範囲・解決根拠・host 省略の扱いが決まったため、frontends が契約に準拠して実装できるよう、実処理より先に契約を固定する。

## Current Observed State

- ShuttlePub main(#23 マージ済み)には `GET /api/v1/profiles/{profile_nanoid}/notes/search`(`searchPersonalNotes`)があり、`author` は `ActorUrl`(canonical actor ID URL)のみで acct を受けない。acct から作者を特定する手段・入力中の作者候補を返す手段は /api/v1 に存在しない
- 外部照会(WebFinger・actor 取得)を禁じる契約も、候補の対象集合(漏洩防止)の契約も存在しない
- ErrorCode に 429 `rate_limited`、内部 lookup の 503(`author_lookup_timeout`・`author_lookup_unavailable`)がない。`search_timeout`(#23)は検索の時間上限用で別物

## Accepted Baseline You May Assume

- ShuttlePub の WebAPI 定義は server 層(Axum + utoipa)で、生成 schema `openapi/shuttlepub.json` が契約の正本(S0 ADR)。ハンドラーは extractor なしで常に明示的な 501(`ApiV1Error::not_implemented()`、`todo!`/`unimplemented!` は使わない)、route は `routes!` で単一登録、S0 の再生成差分 CI がある。#23・#21・#25 の流儀に合わせる
- ユーザー決定(d04-q13〜q15、ui-spec §1): 候補の対象集合は ShuttlePub が投稿を取得済みの作者のうち閲覧 Profile が公開参照可能なものだけで、ミュート・ブロック中の相手(個別・ドメイン)は候補に出さない。Emumet の共有表示キャッシュ全件は他 Profile の block/mute 起因の取得履歴を漏らすため使わない。`@user@host` の解決根拠は自サーバーの確定 username か検証済み remote acct 対応のみで、表示用に導出した acct(preferred_username＋actor host、WebFinger 未検証)では解決せず、外部照会はしない(ui-spec §2)。host 省略の `from:@alice` は自サーバーの alice として扱う
- 既知 actor の明示指定時の検索は #23 の規則(mute/block domain は 404 でなく空結果の 200)を維持する
- 本 unit は契約のみ。後続 unit が実処理(取得済み作者集合・Emumet からの外部取得を誘発しない read-only 連携・検証済み remote acct 対応の保存と供給)を担う

## Target Repo / Path / Part

Repository: `ShuttlePub/ShuttlePub`

- Target paths: `server/`, `openapi/shuttlepub.json`

Target part: server 層の新規 `search_author` モジュール — `resolveNoteSearchAuthor` / `suggestNoteSearchAuthors` の入力検査・型・utoipa・生成 OpenAPI・fixture・明示的 501 スタブ。kernel / application / driver / migration、Emumet、frontends は変更しない。

## In Scope

- 新規 `server/src/api_v1/search_author.rs`、`server/src/api_v1.rs` への登録と `ErrorCode` の追加(`rate_limited`・`author_lookup_timeout`・`author_lookup_unavailable`)、必要なら `server/src/openapi.rs`、`openapi/shuttlepub.json` の再生成、server テスト・fixture、server 契約文書
- `GET /api/v1/profiles/{profile_nanoid}/search/authors/resolve?acct=...`(`resolveNoteSearchAuthor`)と `GET /api/v1/profiles/{profile_nanoid}/search/authors/suggestions?prefix=...`(`suggestNoteSearchAuthors`)。`profile_nanoid` は閲覧者の Profile。bearer_auth 必須(将来契約)。handler は常に明示的な 501
- resolve 入力: acct 1 個。`user@host`・`@user@host`・host 省略 `user`/`@user`(自サーバーの username)。先頭 @ のみ除去、username を小文字化せず host を推測しない。空値・複数・空白・制御/bidi 制御文字・URL 構文混入・不正 host は 400 `invalid_request`(details.field=acct)。正規化後 512 文字上限、host は DNS/IDNA 制約検査。`from:` 前置・actor URL は受けない
- suggestions 入力: prefix 必須、先頭 @ 除去後 1〜512 文字。表示名または acct の前方一致(部分一致・正規表現・wildcard なし、`%`/`_` はリテラル)。照合時のみ Unicode 正規化と小文字化、返却表記は保持。順序: acct 完全一致 → acct 前方一致 → 名前前方一致、同順位は正規化 acct・actor URL。actor URL で重複排除、最大 5 件、ページング・total なし
- 対象集合(契約文書に明記): ShuttlePub が投稿を取得済みの作者のうち閲覧 Profile が公開参照可能なもの。ミュート・ブロック(個別・ドメイン)中の相手は候補に出さない。resolve の根拠は自サーバー確定 username か検証済み remote acct 対応のみ。外部照会は同期・非同期とも一切しない
- 応答(閉じた schema): `SearchAuthor{actor_url: ActorUrl, acct, display_name: string|null, icon_url: string|null}`、`ResolveAuthorResponse{profile_id, author}`、`SuggestAuthorsResponse{profile_id, items: 0..5}`。inbox・公開鍵・Account ID・関係状態・取得由来・キャッシュ時刻は返さない。`Cache-Control: private, no-store` を文書化
- エラー: 400 / 401 / 403 / 404(未取得・対応なしの acct、details.field=acct)/ 409(acct 対応が複数で確定不可、先頭を採用しない)/ 429 `rate_limited`(Retry-After)/ 500 / 503 `author_lookup_timeout`・`author_lookup_unavailable`(内部 lookup。WebFinger ではない。#23 の `search_timeout` とは別)/ 今回の実応答 501。候補なしは 200 `items: []`。エラーを候補 0 件や作者不在に変換しない
- 純粋な入力検査関数・schema fixture(正負)・test-only 参照投影・router/schema 単一登録と決定性・既存 S0/S3/S8/検索契約の回帰テスト

## Out Of Scope

- 実処理(取得済み作者集合の参照、Emumet からの外部取得を誘発しない read-only 連携、検証済み remote acct 対応の保存・供給)。後続 unit
- 外部照会(WebFinger・actor 取得)。同期・非同期とも契約として禁止。外部照会ありは将来の仕様変更候補
- DB・HTTP・バックグラウンド取得・認証サービスへの依存の追加、kernel / application / driver / migration の変更
- Emumet の変更、frontends の schema pin 更新・画面(別 unit)。remote icon をブラウザが直接読む IP 漏洩は frontends の画像ポリシーで扱う
- `searchPersonalNotes`(#23)・timeline・notifications など既存契約の変更
- 複数作者(OR)、部分一致・正規表現・wildcard の候補検索、ページング、total

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/ShuttlePub の server 層に新規 `search_author` モジュールを作り、`resolveNoteSearchAuthor`(acct→作者の特定)と `suggestNoteSearchAuthors`(入力中の作者候補、最大 5 件)の 2 operation の入力検査(純粋関数)・型・utoipa・生成 OpenAPI(`openapi/shuttlepub.json` 再生成)・正負 fixture・test-only 参照投影・server 契約文書を追加し、`ErrorCode` に `rate_limited`・`author_lookup_timeout`・`author_lookup_unavailable` を加えること。対象集合(取得済み・公開参照可能な作者、ミュート/ブロック中は候補から除外)と、外部照会をしないことを契約として明記する。handler は extractor なしで常に明示的な 501 とし、DB・HTTP・バックグラウンド取得・認証サービスへの依存を追加しない。kernel / application / driver / migration・Emumet・frontends は変更せず、既存 S0/S3/S8/検索契約のテストと再生成差分 CI を含む既存 CI がグリーンであること。

## Acceptance Criteria

- 2 operation が `routes!` で単一登録され、生成 schema と契約文書で認可(bearer_auth 必須、Profile の閲覧者本人)・対象集合・非外部照会・入出力・エラーが一致する。handler は extractor なしで常に 501 で、不正入力・未認証でも 400 や成功を返さない
- 対象集合: 取得済みの作者のうち閲覧 Profile が公開参照可能なものだけ。ミュート・ブロック(個別・ドメイン)中の相手は候補に出さない。Emumet の共有表示キャッシュ全件は使わない。resolve の根拠は自サーバー確定 username か検証済み remote acct 対応のみで、表示用に導出した acct(WebFinger 未検証)では解決しない。外部照会は同期・非同期とも一切しない。既知 actor の明示指定時の検索は #23 の規則を維持
- resolve 入力: acct 1 個(`user@host`・`@user@host`・host 省略 `user`/`@user`)。先頭 @ のみ除去、username を小文字化せず host を推測しない。空値・複数・空白・制御/bidi 制御文字・URL 構文混入(`from:`/`acct:` 前置・actor URL を含む)・不正 host は 400 `invalid_request`(details.field=acct)。正規化後 512 文字上限、host は DNS/IDNA 制約検査
- suggestions 入力: prefix 必須、先頭 @ 除去後 1〜512 文字、表示名または acct の前方一致、`%`/`_` はリテラル、照合時のみ Unicode 正規化と小文字化(返却表記は保持)。順序: acct 完全一致 → acct 前方一致 → 名前前方一致、同順位は正規化 acct・actor URL。actor URL で重複排除、最大 5 件、ページング・total なし
- 応答: `SearchAuthor`(actor_url は #23 の author と同じ `ActorUrl`、acct は先頭 @ なし、display_name・icon_url は string|null)、`ResolveAuthorResponse`、`SuggestAuthorsResponse`(0〜5 件)。閉じた schema(未知フィールド拒否)。inbox・公開鍵・Account ID・関係状態・取得由来・キャッシュ時刻を返さない。`Cache-Control: private, no-store` が文書化される
- エラー: 400 / 401 / 403 / 404(details.field=acct)/ 409(先頭を勝手に採用しない)/ 429 `rate_limited`(Retry-After)/ 500 / 503 `author_lookup_timeout`・`author_lookup_unavailable`(WebFinger ではない内部 lookup、`search_timeout` とは別)/ 501。候補なしは 200 `items: []`。エラーを候補 0 件や作者不在に変換しない。既存 ErrorCode の意味は不変
- テスト: 純粋な入力検査関数(完全 acct、先頭 @、host 省略、host 正規化、長さ境界、空・複数・制御/bidi・URL 混入、空 prefix、Unicode 名、%/_ リテラル)、正負 schema fixture(local/remote、表示項目 null、候補 0/1/5 件、6 件・不正 actor_url・必須欠落・未知フィールドの拒否、404/409/503/429/501)、test-only 参照投影(前方一致・順序・重複排除・最大 5・mute/block 除外・acct 曖昧時 409・成功した actor_url を #23 の author validator が受理)、router/schema 単一登録と生成の決定性、既存 S0/S3/S8・検索契約の回帰なし
- DB・HTTP・バックグラウンド取得・認証サービスへの依存を追加しない。kernel / application / driver / migration・Emumet・frontends を変更しない。`openapi/shuttlepub.json` が決定的に再生成され再生成差分 CI がグリーン

## Verification

- 純粋関数のテスト(acct / prefix の正規化と拒否、長さ境界、照合用の正規化)
- schema fixture(正負)を生成 schema に照合し、型(serde)と一致することを確認
- test-only 参照投影による前方一致・順序・重複排除・最大 5・mute/block 除外・409 の検証と、成功した actor_url を #23 の author validator(`is_canonical_actor_url`)が受理すること
- 両 route が常に 501 を返す route テスト、router/schema の単一登録・決定性、既存 S0/S3/S8・検索契約の回帰テスト
- Rust CI(fmt / clippy -D warnings / test / build / git diff --check)と openapi 再生成差分 CI がグリーン

## Related Links

- 依存ユニット: shuttlepub-openapi-foundation(ShuttlePub/ShuttlePub#14)、personal-domain-content-api-contract(ShuttlePub/ShuttlePub#18、PR #19)、note-search-api-contract(ShuttlePub/ShuttlePub#22、PR #23)
- 意図: intents/shuttlepub/product/social-experience.md (I04)、intents/shuttlepub/packets/candidates.md (D04)、intents/shuttlepub/features/note-search-ui/ui-spec.md (§1・§2)
- 決定記録: intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d04-q13-author-suggestion-scope、d04-q14-acct-resolution-basis、d04-q15-host-omitted-acct)

## Knowledge Maintenance

- Intent placement: 決定は host へ記録済み(c59a192)。完了時に social-experience.md I04 節と candidates.md D04 節へ unit の到達範囲・依存・残余を追記(新規 intent ノード不要)
- ADR candidate: none(S0 の生成 schema 正本 ADR に従う。決定は d04-q13〜q15 に記録済み)
- Diagram candidate: none
- Docs update: D04 / I04 に「API 契約のみ」と残余(実処理・外部照会ありは将来の仕様変更候補・frontends の schema pin と画面は別 unit・remote icon の IP 漏洩は frontends の画像ポリシー)を記録
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/ShuttlePub (`server/`, `openapi/shuttlepub.json`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
