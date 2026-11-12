## Goal

D02(利用許諾)・D10(センシティブ分類)・D11(画像タグ)の画像メタデータを Booskiff に置くための producer 契約を、設計文書として確定させる。file 単位メタデータ(利用許諾の参照と固定状態、通常タグ、共通センシティブ分類 ID、revision)、所有者向け更新 API、ShuttlePub 向けの内部 API(初回共有の固定、メタデータ取得、変更通知)、許諾カタログ(CC 8 選択肢+管理者独自許諾の版参照)、Booskiff と ShuttlePub の責務分担を、API 案・状態遷移表・認可/競合/失敗のテストベクトルとして ShuttlePub/Booskiff の docs 配下に文書化する。稼働コード(migration・route・handler)は追加しない。

## Why This Slice Exists Now

D02/D10/D11 は画像メタデータの保存先を Booskiff に決定済み(d02-q07)だが、初回他者共有時の固定・所有者認可・共有失敗との整合・タグ/分類の更新波及・管理者追加許諾の版固定などの契約が未定義のまま。これらを別々に実装すると境界(固定トリガー、revision、認可、キャッシュ)が破綻するため、実装 unit(許諾・タグ/分類・共有固定・変更通知)へ分割する前に producer 契約を 1 つの設計として固める。小さく独立した unit を優先する着手方針に沿い、第 1 便の設計 unit として UI・ShuttlePub 実装と独立に進める。

## Current Observed State

- Booskiff main(2026-11 時点)の `FileResponse` は ID・名前・MIME・容量・folder・公開状態・作成日時のみ。許諾・通常タグ・センシティブ分類・共有固定状態は存在しない
- 所有は `files.owner_type` + `owner_id`(JWT の `sub` と owner 種別から導出する Account)。Booskiff は Profile 概念を持たない(D4)。投稿用 Profile は所有者ではない
- 公開は `/public/{key}`(推測不能キー、`Cache-Control: public, max-age=31536000, immutable`)。unpublish/削除しても外部キャッシュは失効しない(docs/drive/caching.md)。publish は共有固定のトリガーではない(d02-q06)
- エラー形式は `{"error":{"code","message"}}`(`conflict` は 409 のみで理由の区別がない)。utoipa による OpenAPI 生成と CI の openapi-drift 検査がある
- ShuttlePub 側に投稿添付・Booskiff 連携の実装はまだない(Note 基盤・OpenAPI 契約のみ)。連合配送は Emumet 経由

## Accepted Baseline You May Assume

- 画像メタデータ(利用許諾・通常タグ・センシティブ分類)の保存先は Booskiff、ShuttlePub は投稿表示時に参照する(d02-q07)
- 利用許諾は file 共通(d02-q01)。初回は CC 4.0 全 6 種・CC0 1.0・未指定の 8 選択肢。新規 file は未指定、選んだ時だけ付与(q02〜q04)。独自文章/URL 指定は初回外だが、管理者が独自許諾を最初から追加できる(q11、定義形式と連合表現は技術設計)
- 初めて他者向け投稿(限定共有を含む)で共有した時点で許諾を固定し、公開後の選び直し・未指定からの追加は初回外。upload や公開 URL 生成では固定しない(q05, q06)。固定対象は許諾のみで、通常タグ・センシティブ分類は編集可能(d11-q01)
- 既存画像はすべて未指定、未共有の画像だけ後から許諾を設定できる(q08)。設定できるのは file 所有者のみ(所有者が権利者本人であることは保証しない)(q09)。同一 bytes でも別 file は別扱い(q10)
- センシティブ分類はサーバー管理側が共通分類を用意し投稿者が選ぶ。D10 と D11 で同一契約(d10-q01)。通常タグは自由入力・複数・補完(自分のタグ優先、その後サーバー全体)(d11-q02)で、ActivityPub 拡張として送信し非対応側は無視(d11-q03)
- 同じ file を使う自分の他投稿へ通常タグ・分類の編集を反映し、失敗分のみ自動再試行、成功分は維持(d11-q01, q04)。本文・本文分類・別 file・他人の投稿は変更しない
- ユーザー判断待ち(本 unit では未決として保留し、両案比較・推奨・依存箇所の明示まで行う): D11 の「自分の他投稿」の範囲(同じ Profile のみ/同じ Account の全 Profile)と、同一 file を他人・別 Profile が再利用した場合の扱い。推奨は同じ Profile のみ、対象外投稿は参照版固定

## Target Repo / Path / Part

Repository: `ShuttlePub/Booskiff`

- Target paths: `docs/`

Target part: "画像メタデータ(利用許諾・通常タグ・センシティブ分類)の producer 契約設計文書(API 案・状態遷移表・テストベクトル・責務分担・未決事項)。稼働コードは追加しない"

## In Scope

- file 単位メタデータモデル: file ID・所有者(Account)・メタデータ revision・許諾参照(id+版)・許諾の状態(未固定/予約中/固定)・通常タグ・共通センシティブ分類 ID
- 許諾カタログ: 8 初期選択肢+管理者独自許諾の定義形式案、版参照(固定済み file は管理者の定義変更で条件が変わらない)、廃止の扱い
- 所有者向け API 案(許諾設定・タグ/分類の更新・補完候補)と ShuttlePub 向け内部 API 案(初回共有の予約/確定/解放、メタデータ一括取得、変更フィード)の route・型案(utoipa 型定義は文書内のコード例に留める)
- 状態遷移表: 許諾の固定状態、共有予約、既存画像の状態例(すべて未指定・既共有は固定・未共有だけ後設定可能)
- 下書き・自分だけ・限定共有・予約投稿・投稿拒否・応答喪失・同時変更・連合配送失敗の扱い
- 認可・競合・失敗のテストベクトル(別 file・他人の投稿を誤更新しない、固定後の許諾変更拒否、タグ/分類は更新可能 等)
- Booskiff / ShuttlePub / Emumet / frontends の責務分担表、キャッシュ方針(可変メタデータに immutable キャッシュを使わない)
- 未決事項一覧(ユーザー判断待ち/技術判断/他 unit との合意事項)と、後続実装 unit への分割案・順序

## Out Of Scope

- DB migration、稼働 route/handler、OpenAPI 生成物(openapi.json)の変更、既存画像のデータ移行の実行
- ShuttlePub の投稿処理・添付投影・連合配送(Update 送信)・失敗分再試行の実装と、ShuttlePub 側の API 契約(別 unit)
- UI(許諾選択・固定表示・タグ入力・分類選択)と UI モック
- D11 の「自分の他投稿」範囲の決定(保留)。公開後の許諾変更・変更履歴・管理者による分類訂正・共有(D9)・組織 Drive の権限は初回外

## Standalone Child Issue Contract

この issue の子 PR が単体で納めるもの: ShuttlePub/Booskiff の docs 配下に、画像メタデータ(許諾・通常タグ・センシティブ分類)の producer 契約設計文書(モデル、許諾カタログと版参照、所有者向け/内部 API 案、状態遷移表、認可・競合・失敗のテストベクトル、Booskiff と ShuttlePub の責務分担、未決事項と後続 unit 分割案)を追加し、docs/README.md に索引を追加すること。migration・稼働 route・openapi.json は変更しない。D11 の反映範囲と他人・別 Profile の再利用はユーザー判断待ちとして両案比較・推奨・依存箇所の明示に留め、決定しない。PR はマージせず独立レビューを経る。

## Acceptance Criteria

- 設計文書が ShuttlePub/Booskiff の docs 配下(docs/drive/ の慣例に沿う)に追加され、docs/README.md の索引から辿れる
- メタデータモデル(file ID・所有者・revision・許諾の版参照と固定状態・通常タグ・センシティブ分類 ID)、許諾カタログ(8 選択肢+管理者独自許諾、版参照)、API 案(所有者向け/ShuttlePub 向け内部)が型案・route・エラーを含めて定義される
- 状態遷移表が、限定共有・下書き・自分だけ・予約投稿・投稿拒否・応答喪失・同時変更・連合配送失敗を説明でき、既存画像の状態例(すべて未指定・既共有は固定・未共有だけ後設定可能)を含む
- 許諾は初回共有で固定されても、通常タグ・センシティブ分類は固定後も更新可能であることが API・状態遷移・テストベクトルで示される
- 別 file(同一 bytes を含む)・他人の file・他人の投稿を誤って更新・固定しないことが認可・競合・失敗のテストベクトルで示される。所有者以外は 404(存在秘匿)等の応答規約が定義される
- 可変メタデータに /public/{key} の immutable キャッシュを流用しないこと、メタデータ変更で画像 bytes・公開 URL が変わらないこと、file 削除/unpublish を許諾取消しと扱わないことが明記される
- Booskiff と ShuttlePub の責務分担(固定トリガー・変更通知・対象投稿の特定・失敗分再試行・連合表現)が表で示され、child への親状態の移管をしない
- 未決の製品判断(D11 反映範囲、他人・別 Profile の再利用)は保留として、両案比較・推奨案(同じ Profile のみ、対象外投稿は参照版固定)・判断に依存する箇所が明示され、技術判断・他 unit 合意事項と区別される
- 後続実装 unit(許諾、タグ・分類、共有固定、変更通知)への分割案と依存順序が示される。稼働コード・migration・openapi.json は変更されない

## Verification

- 文書の記述が Booskiff main の実装(core/src の files/auth/public/error/api_doc、migrations)と矛盾しないことを根拠コード付きで確認する
- 文書内のコード例(型案・SQL 案・JSON 例)が稼働コードとして追加されていないこと(`git diff --stat` が docs/ のみ)
- 既存 CI(fmt / clippy / test / openapi-drift / e2e / image)が緑のまま(docs のみの変更)。`git diff --check` が通る
- 独立レビューで、テストベクトルが認可・競合・失敗(応答喪失・同時変更・投稿拒否)を網羅し、未決事項が決定済み事項と混ざっていないことを確認する

## Related Links

- 意図: intents/booskiff/features/media-metadata.md、intents/shuttlepub/product/social-experience.md (I02, I11)
- 候補: intents/shuttlepub/packets/candidates.md (D02, D10, D11)
- 決定記録: intents/shuttlepub/interviews/discord-feature-grill-2026-10-15.json (d02-q01〜q11, d10-q01〜q11, d11-q01〜q04)
- Booskiff 既存仕様: docs/drive/caching.md、docs/drive/public-access.md、docs/operations.md、intents/booskiff/decisions/2026-08-29-initial-shaping.md (D4, D12, D19)
- 後続(別 unit): Booskiff 許諾/タグ・分類/共有固定/変更通知の実装、ShuttlePub 添付投影・連合表現・失敗分再試行の API 契約、frontends の許諾・タグ UI(モック合意が必要)

## Knowledge Maintenance

- Intent placement: intents/booskiff/features/media-metadata.md と candidates.md の D02/D10/D11 節に、本 unit の範囲(契約設計のみ、実装未着手)と成果物の場所を追記(新規 intent ノード不要)
- ADR candidate: none(設計文書内の「推奨」は未確定。確定後に必要なら起票)
- Diagram candidate: none(状態遷移は文書内の表で表現)
- Docs update: ShuttlePub/Booskiff の docs/ に設計文書を追加(本 PR の成果物)
- Closeout writeback expected: yes

## Guide Reachability (G645)

`guide workflow task implementation-loop` (implementation ロール) が ShuttlePub/Booskiff (`docs/`) へルーティングする。

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
