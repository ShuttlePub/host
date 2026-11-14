# 画像の利用条件とタグ (candidate、2026-10-15受領)

## 受領した意図

- [I02](../../shuttlepub/product/social-experience.md#i02): 添付画像の他者による利用範囲を
  指定・表示できるようにする。初回はCC 4.0の全6種・CC0 1.0・未指定を選べ、新規画像の未選択時は未指定。限定共有を含め初めて他者向け投稿で共有すると条件を固定し、CC BY ND既定は歴史的提案として保持する。固定処理や既存file移行は検証待ち。
- [I11](../../shuttlepub/product/social-experience.md#i11): 画像に複数タグを付け、既存タグの
  補完を使いたい。通常／センシティブの区別と外部でのCW表現も含む。

## 責務の第一候補

Booskiffはfile保管・Account単位所有の正本なので、共通file metadataはBooskiffの候補。
利用条件はfile共通で各投稿から参照する方針を採用した。添付からの条件参照・分類の投影等はShuttlePubの責務になり得る。
file／attachmentの保存正本・更新権限・参照時の優先順位を先に決める。利用条件の共通単位と、タグ／分類訂正の反映範囲は別の決定として扱う。
ファイルmetadataをBooskiffへ確定配置した決定ではない。

APIが必要なら `ShuttlePub/Booskiff`、投稿添付・CWへの写像なら `ShuttlePub/ShuttlePub`、
編集・補完・表示UIなら `ShuttlePub/shuttlepub-frontends` へpacketを分割する。
Emumetのmedia-uploadはactor icon/bannerの既存範囲として扱い、完了packetを
投稿添付機能の実装済み根拠にしない。

## 候補と未決事項

- [D02](../../shuttlepub/packets/candidates.md#d02): [grill記録](../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json)の
  `d02-q01-file-shared-license`で、利用条件の適用／参照単位をfile共通とし、同じfileを使うP1・P2で共通条件を示す方針を採用した。
  `d02-q02-preset-license-selection`で、初回はプリセット選択と「未指定」を採用し、独自文章／URLによる条件登録は初回外とした。公式原文リンクの表示は禁止しない。
  `d02-q03-unspecified-default-license`で、新規fileの条件未選択時は未指定、CC等は利用者の選択時に付ける初期値を採用した。原案のCC BY ND既定は現行初期値に採用しない。
  `d02-q04-initial-license-presets`で、初回はCC 4.0全6種・CC0 1.0・未指定の8選択肢を採用した。CC0は6種のライセンスとは別の、法の許す範囲で著作権等を放棄するツールとして区別する。
  初期値未指定・選択時だけ付与は維持し、既存fileへ一括適用しない。未指定は追加許諾を示さない意味で、全面的な再利用禁止や既存許諾取消ではない。
  `d02-q05-freeze-license-after-publication`で、初回は公開時のfile共通条件を固定し、公開後の選び直し・未指定からCC等の追加も提供しない方針を採用した。タグ／センシティブ分類の編集はD11の方針を維持する。
  `d02-q06-freeze-on-first-sharing`で、公開範囲を問わず、限定共有でも初めて他者向け投稿で共有した時点で固定する。uploadや公開URL生成だけでは固定しない。
  下書き／自分だけの投稿・送信失敗／予約／同時変更と固定処理の整合・実装lock時点、管理者の選択肢追加／例外、既存file移行・カスタム既定値／前回継承、同一bytes別fileの統合・権利処理、保存正本／API・認可・表示／連合写像は検証待ち。Booskiff配置は確定しない。
  投稿ごとの別条件は採用せず、公開後変更・変更履歴・更新波及は初回外。削除／再uploadで過去の許諾を取り消せる決定ではない。
- [D11](../../shuttlepub/packets/candidates.md#d11): [grill記録](../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json)の
  `d10-q01-managed-sensitive-taxonomy`で、初回のセンシティブ分類はサーバー管理側が用意し投稿者が選択、D10と共通とした。
  通常タグの自由入力・複数タグ・補完は維持し、その補完辞書のowner・共有範囲・正規化は未決。
  `d11-q01-propagate-media-label-edits`で、一投稿内で直した画像の通常タグ・センシティブ分類を、同じ画像fileを使う自分の他投稿にも反映する方針を採用した。
  本文／本文分類・同一bytesの別file・他人投稿は変更しない。分類管理主体や反映範囲の決定は、Booskiff正本配置・両属性の物理保存単位の確定ではない。
  file／attachmentの責務・正本／優先順位／投影／認可、自分投稿の特定・同時編集／部分失敗等の反映契約は設計・検証する。
  共通管理画面操作・再利用初期値・管理者訂正等は別論点で、再uploadや公開URL上書きを必須方式にはしない。
  通常タグの外部表現は「未送信」か「拡張送信して非対応側が無視」か未決。D10と分類schemaを重複させない。

## 契約設計の完了（2026-11-14、media-metadata-contract-design）

- **成果物**: [ShuttlePub/Booskiff PR #8](https://github.com/ShuttlePub/Booskiff/pull/8)（squash `5c72e5c`、issue #7、独立レビュー承認・CI 緑）。Booskiff の `docs/media-metadata/`（README・api・state-machine・test-vectors）。**設計のみ**で、migration・route・openapi.json・UI・ShuttlePub 側の実装は未着手。D02/D10/D11 の親 candidate 全体は ready／完了ではない。
- **確定した契約案**: file 単位・Account 所有・revision 付き（行なし＝未指定・未固定・revision 0。移行で既存データを書き換えない）。許諾は `license_id`+`version` の版参照でカタログ行は不変（CC 8 選択肢＋管理者独自許諾）。
  固定は ShuttlePub が他者向け投稿として確定する直前に、予約→（未公開で永続化）→確定／解放の 2 相。`commit` 成功まで他者に見せない契約。連合配送失敗は固定を解かない。固定後もタグ・分類は更新可。
  変更フィードは通知のみ、真実は一括取得、対象特定・失敗分再試行は ShuttlePub の `applied_revision`。既存画像は backfill（既共有は未指定のまま固定、未共有だけ後設定可能）。テストベクトル 145 項目。
- **ユーザー決定の記録**: D11 の反映範囲は案 B（同じ Account の全 Profile の投稿）。他 Account による同一 file の再利用は R1（当面禁止、所有者のみ予約・添付可。共有 D9 の決定後に見直し。grill `d02-q12-other-account-file-reuse` に記録中）。
- **残る技術判断・合意**: T1〜T11 は設計者の推奨で未確定。センシティブ分類の語彙（ID は仮）は ShuttlePub の D10 契約と要合意。独自許諾・タグ・センシティブの連合表現、サービス JWT の発行元も他 unit と合意が要る。
- **後続**: Booskiff の実装 unit（許諾カタログ → メタデータ基盤 → 許諾選択 → 共有固定 → 変更フィード／タグ補完）、ShuttlePub の契約・実装 unit、frontends の UI。いずれも未登録。
[受領原文S02/S11](../../shuttlepub/drafts/discord-feature-intake-2026-10-15.md)。
