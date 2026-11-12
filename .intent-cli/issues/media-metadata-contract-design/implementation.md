# media-metadata-contract-design Implementation Packet

## Goal

D02(利用許諾)・D10(センシティブ分類)・D11(画像タグ)の画像メタデータを Booskiff に置くための producer 契約を、設計文書として確定させる。file 単位メタデータ(利用許諾の参照と固定状態、通常タグ、共通センシティブ分類 ID、revision)、所有者向け更新 API、ShuttlePub 向けの内部 API(初回共有の固定、メタデータ取得、変更通知)、許諾カタログ(CC 8 選択肢+管理者独自許諾の版参照)、Booskiff と ShuttlePub の責務分担を、API 案・状態遷移表・認可/競合/失敗のテストベクトルとして ShuttlePub/Booskiff の docs 配下に文書化する。稼働コード(migration・route・handler)は追加しない。

## Why

D02/D10/D11 は画像メタデータの保存先を Booskiff に決定済み(d02-q07)だが、初回他者共有時の固定・所有者認可・共有失敗との整合・タグ/分類の更新波及・管理者追加許諾の版固定などの契約が未定義のまま。これらを別々に実装すると境界(固定トリガー、revision、認可、キャッシュ)が破綻するため、実装 unit(許諾・タグ/分類・共有固定・変更通知)へ分割する前に producer 契約を 1 つの設計として固める。小さく独立した unit を優先する着手方針に沿い、第 1 便の設計 unit として UI・ShuttlePub 実装と独立に進める。

## Scope

- file 単位メタデータモデル: file ID・所有者(Account)・メタデータ revision・許諾参照(id+版)・許諾の状態(未固定/予約中/固定)・通常タグ・共通センシティブ分類 ID
- 許諾カタログ: 8 初期選択肢+管理者独自許諾の定義形式案、版参照(固定済み file は管理者の定義変更で条件が変わらない)、廃止の扱い
- 所有者向け API 案(許諾設定・タグ/分類の更新・補完候補)と ShuttlePub 向け内部 API 案(初回共有の予約/確定/解放、メタデータ一括取得、変更フィード)の route・型案(utoipa 型定義は文書内のコード例に留める)
- 状態遷移表: 許諾の固定状態、共有予約、既存画像の状態例(すべて未指定・既共有は固定・未共有だけ後設定可能)
- 下書き・自分だけ・限定共有・予約投稿・投稿拒否・応答喪失・同時変更・連合配送失敗の扱い
- 認可・競合・失敗のテストベクトル(別 file・他人の投稿を誤更新しない、固定後の許諾変更拒否、タグ/分類は更新可能 等)
- Booskiff / ShuttlePub / Emumet / frontends の責務分担表、キャッシュ方針(可変メタデータに immutable キャッシュを使わない)
- 未決事項一覧(ユーザー判断待ち/技術判断/他 unit との合意事項)と、後続実装 unit への分割案・順序

## Out of scope

- DB migration、稼働 route/handler、OpenAPI 生成物(openapi.json)の変更、既存画像のデータ移行の実行
- ShuttlePub の投稿処理・添付投影・連合配送(Update 送信)・失敗分再試行の実装と、ShuttlePub 側の API 契約(別 unit)
- UI(許諾選択・固定表示・タグ入力・分類選択)と UI モック
- D11 の「自分の他投稿」範囲の決定(保留)。公開後の許諾変更・変更履歴・管理者による分類訂正・共有(D9)・組織 Drive の権限は初回外

## Design notes

- 固定トリガーは Booskiff の publish ではなく、ShuttlePub の「他者向け投稿として受理・確定」。予約→確定→解放の 2 相で、投稿拒否・応答喪失・同時変更・予約投稿を説明する案を比較する(1 相の確定のみ案との比較を含む)
- 許諾は版参照(id+版)で保持し、管理者の定義変更で固定済み file の条件を変えない
- タグ/分類は revision 付き更新+変更フィード(冪等 consumer)。対象投稿の特定・Update 送信・失敗分再試行は ShuttlePub の責務
- Booskiff は Profile を持たない。D11 の反映範囲は ShuttlePub 側の判断に閉じ、Booskiff 契約は両案で同形にする
- 所有者以外には存在を秘匿(404)。所有者向け API の token を他者閲覧に流用しない

## Verification

- 文書の記述が Booskiff main の実装(core/src の files/auth/public/error/api_doc、migrations)と矛盾しないことを根拠コード付きで確認する
- 文書内のコード例(型案・SQL 案・JSON 例)が稼働コードとして追加されていないこと(`git diff --stat` が docs/ のみ)
- 既存 CI(fmt / clippy / test / openapi-drift / e2e / image)が緑のまま(docs のみの変更)。`git diff --check` が通る
- 独立レビューで、テストベクトルが認可・競合・失敗(応答喪失・同時変更・投稿拒否)を網羅し、未決事項が決定済み事項と混ざっていないことを確認する

## Knowledge Maintenance (G461)

- Intent placement: media-metadata.md と candidates.md D02/D10/D11 節へ範囲を追記(新規ノード不要)
- ADR candidate: none
- Diagram candidate: none
- Docs update: Booskiff docs/ に設計文書を追加
- Closeout learning: 固定境界(予約/確定/解放)と、ユーザー判断待ち 2 点の確定内容を candidates.md / media-metadata.md へ writeback

- Guide reachability (G645): implementation ロール → ShuttlePub/Booskiff `docs/`(guide workflow task implementation-loop)。
