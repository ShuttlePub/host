# 画像の利用条件とタグ (candidate、2026-10-15受領)

## 受領した意図

- [I02](../../shuttlepub/product/social-experience.md#i02): 添付画像の他者による利用範囲を
  指定・表示できるようにする。既定CC BY NDは提案。版や既存画像への適用は未決。
- [I11](../../shuttlepub/product/social-experience.md#i11): 画像に複数タグを付け、既存タグの
  補完を使いたい。通常／センシティブの区別と外部でのCW表現も含む。

## 責務の第一候補

Booskiffはfile保管・Account単位所有の正本なので、共通file metadataはBooskiffの候補。
ただし同一fileを複数投稿で使う際の添付ごとの条件・分類はShuttlePubの責務になり得る。
file／attachmentの保存単位・更新権限・参照時の優先順位を先に決める。
ファイルmetadataをBooskiffへ確定配置した決定ではない。

APIが必要なら `ShuttlePub/Booskiff`、投稿添付・CWへの写像なら `ShuttlePub/ShuttlePub`、
編集・補完・表示UIなら `ShuttlePub/shuttlepub-frontends` へpacketを分割する。
Emumetのmedia-uploadはactor icon/bannerの既存範囲として扱い、完了packetを
投稿添付機能の実装済み根拠にしない。

## 候補と未決事項

- [D02](../../shuttlepub/packets/candidates.md#d02): 利用条件の粒度・権利者・変更方針と
  表示／連合への写像を定める。保存・取得・参照先表示で条件が食い違わないことを検証する。
- [D11](../../shuttlepub/packets/candidates.md#d11): [grill記録](../../shuttlepub/interviews/discord-feature-grill-2026-10-15.json)の
  `d10-q01-managed-sensitive-taxonomy`で、初回のセンシティブ分類はサーバー管理側が用意し投稿者が選択、D10と共通とした。
  通常タグの自由入力・複数タグ・補完は維持し、その補完辞書のowner・共有範囲・正規化は未決。
  `d11-q01-propagate-media-label-edits`で、一投稿内で直した画像の通常タグ・センシティブ分類を、同じ画像fileを使う自分の他投稿にも反映する方針を採用した。
  本文／本文分類・同一bytesの別file・他人投稿は変更しない。分類管理主体や反映範囲の決定は、Booskiff正本配置・両属性の物理保存単位の確定ではない。
  file／attachmentの責務・正本／優先順位／投影／認可、自分投稿の特定・同時編集／部分失敗等の反映契約は設計・検証する。
  共通管理画面操作・再利用初期値・管理者訂正等は別論点で、再uploadや公開URL上書きを必須方式にはしない。
  通常タグの外部表現は「未送信」か「拡張送信して非対応側が無視」か未決。D10と分類schemaを重複させない。

実装仕様・優先順位は未確定、queue未登録、issue未公開。
[受領原文S02/S11](../../shuttlepub/drafts/discord-feature-intake-2026-10-15.md)。
