# 画像の利用条件とタグ (candidate、2026-10-15受領)

## 受領した意図

- [I02](../../shuttlepub/product/social-experience.md#i02): 添付画像の他者による利用範囲を
  指定・表示できるようにする。新規画像の未選択時は未指定を採用し、CC BY ND既定は歴史的提案として保持する。版や既存画像への適用は未決。
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
  未指定は追加許諾を示さない意味で、全面的な再利用禁止や既存許諾取消ではない。具体プリセット一覧・版・管理者の追加可否、既存画像の条件上書き・カスタム既定値／前回継承は未決。
  投稿ごとの別条件は採用せず、版・後変更の既存投稿への反映／法的効力・過去取得者への遡及、
  同一bytes別fileの統合・他人fileの条件変更権限、保存正本／API・表示／連合写像は未決。Booskiff配置は確定しない。
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
