# Discord 提案からの packet 候補

受領日: 2026-10-15。17 件の原案を意図の単位で整理した候補一覧。
全件 **candidate** であり、ready ではない。優先順位未決、queue 未登録、
issue 未公開、仮 slug 未予約。ここに書く受付条件・検証は shaping 用の案で、
実装方式や受け入れ基準の決定ではない。後続grillで採用した方針は各節で明示するが、
それだけで実装packetの受付条件が確定したり、candidateからreadyになったりはしない。

意図の正本は [social-experience.md](../product/social-experience.md)、
受領原文は [intake draft](../drafts/discord-feature-intake-2026-10-15.md)、
原文の機械可読記録は [source JSON](../interviews/discord-feature-intake-2026-10-15.json)。
原文の他製品の現状・API・時期についての記述は、受領した仮説・参考情報であり、
2026-10-15 現在の互換性や実現可能性を保証しない。

## 索引

| ID | 原文 | 意図 | primary domain | 最初の target repo | 後続 repo | status |
|---|---|---|---|---|---|---|
| D01 | S01 | 投稿詳細から前後の投稿・リポストをたどる文脈閲覧 | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/shuttlepub-frontends | candidate |
| D02 | S02 | 添付画像の利用許諾を指定 | booskiff (仮) | ShuttlePub/Booskiff (契約決定後) | ShuttlePub/ShuttlePub、ShuttlePub/shuttlepub-frontends | candidate |
| D03 | S03 | 設定絵文字で 1 操作リアクション | shuttlepub | ShuttlePub/shuttlepub-frontends | 必要時 ShuttlePub/ShuttlePub | candidate |
| D04 | S04 | 特定投稿者に絞る投稿検索 | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/shuttlepub-frontends | candidate |
| D05 | S05 | 開いた投稿への再訪 | shuttlepub | ShuttlePub/shuttlepub-frontends | 同期が必要なら ShuttlePub/ShuttlePub | candidate |
| D06 | S06 | リモート情報の閲覧と自 identity での操作 | shuttlepub | ShuttlePub/Emumet | ShuttlePub/ShuttlePub、ShuttlePub/shuttlepub-frontends | candidate |
| D07 | S07 | 投稿編集と連合上の更新 | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/Emumet、ShuttlePub/shuttlepub-frontends | candidate |
| D08 | S08 | 個人単位のドメインブロック・ミュート | emumet | ShuttlePub/Emumet | ShuttlePub/ShuttlePub、ShuttlePub/shuttlepub-frontends | candidate |
| D09 | S09 | 他鯖のカスタム絵文字リアクションに便乗 | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/shuttlepub-frontends、必要時 ShuttlePub/Emumet | candidate |
| D10 | S10 | 種類別のセンシティブ設定と更新反映 | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/shuttlepub-frontends、必要時 ShuttlePub/Emumet | candidate |
| D11 | S11 | 画像の通常・センシティブタグ | booskiff (仮) | ShuttlePub/Booskiff (契約決定後) | ShuttlePub/ShuttlePub、ShuttlePub/shuttlepub-frontends | candidate |
| D12 | S12 | 投稿・検索の内容に応じた案内と制御 | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/shuttlepub-frontends、必要時 ShuttlePub/Emumet | candidate |
| D13 | S13 | 投稿ごとの反応 Allow リスト | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/shuttlepub-frontends、必要時 ShuttlePub/Emumet | candidate |
| D14 | S14 | サーバーを越えるモデレーション証跡 | emumet / shuttlepub (未決) | 未決 (Emumet / ShuttlePub の共同調査) | 調査結論後に判断 | candidate (調査) |
| D15 | S15 | 安全対策の準備を条件に一般登録を開放 | emumet | ShuttlePub/Emumet | ShuttlePub/shuttlepub-frontends | candidate |
| D16 | S16 | タグ通報によるトレンド抑制 | shuttlepub | ShuttlePub/ShuttlePub | ShuttlePub/shuttlepub-frontends、必要時 ShuttlePub/Emumet | candidate |
| D17 | S17 | turbo 時に見た元投稿と現在の内容を検証 | shuttlepub | ShuttlePub/ShuttlePub | 必要時 ShuttlePub/Emumet、ShuttlePub/shuttlepub-frontends | candidate |

## 共通の分割方針

- D01–D17 は意図候補 ID。既存の決定記録の D 番号とは別の名前空間。
  1 候補をそのまま 1 実行 packet にしない。契約整理後、target repo ごとに
  独立して検証できる最小単位へ分割し、producer の契約と consumer の接続を分ける。
- SNS UI の primary domain は暫定で shuttlepub、実装先は
  `ShuttlePub/shuttlepub-frontends`。既存 ratcap domain はフロントエンドモノレポの
  歴史的記録を持つが、本一覧の全文を複製しない。必要な実装 packet から参照する。
- 既存 Note / reply / turbo / turbo_quote / reaction / timeline 基盤を拡張対象にする。
  現在の main の観察は [意図の正本](../product/social-experience.md) を参照し、
  2026-08-29 の旧実装インベントリを現在の機能欠如の根拠にしない。
- Note の連合送受信、認証接続、永続化等の土台は別の依存として確認する。
  各候補にまとめて再実装する前提を置かない。

<a id="d01"></a>

## D01 — contextual-commentary

- **意図**: [I01](../product/social-experience.md#i01)。文脈を追いたい読者が、独り言に至るまでの
  投稿・リポストを大きな負担なくたどれる体験を中心にする。
- **grillで採用済みの方向**: [正規記録](../interviews/discord-feature-grill-2026-10-15.json)の
  `d01-q01-context-over-repost-appearance`を`d01-q02-low-effort-chronological-context`で具体化。
  低負担で文脈を追えれば方式は問わず、前回の「リポストっぽさ」という表現から導く表示禁止・主従は独立要件にしない。
  元作者への普通の RT 表示は原案の方式仮説として履歴に保持し、必須の受入条件にしない。
  初回の閲覧導線はQ3、リモート履歴補完の範囲はQ5で採用する。
- **候補の状態**: 主要な利用意図は整理済み。リモート取得・ページング等の取得/API契約は検証待ちで、
  実装readyとはしない。candidate・queue未登録・issue未公開・仮slug未予約を維持する。
- **仮 slug**: `contextual-commentary`。
- **初回の閲覧導線として採用済み**: `d01-q03-history-direction-controls`。開いた投稿を起点に、
  前後の投稿・リポストをたどる。過去は下側に表示し、下への無限スクロールで続きを取得する。
  新しい方は上に専用ボタンを置き、押下時に取得する。新しい方のスクロール自動取得・定期ポーリングは追加しない。
  専用引用・明示的な紐付け機能を必須にしない。Misskey・iceshimpはユーザーの体験例であり、
  指定された動作以外の現行実装を採用・検証済みとはしない。
  `d01-q04-context-actor-on-repost`で、通常投稿を直接開く場合は同じ投稿者、タイムラインのリポストから
  開く場合はリポストした人の履歴とする。後者を元作者の履歴へ自動切替しない。
  元投稿の作者表示・操作権限はリポストした人のものへ置き換えない。
- **初回のリモート補完として採用済み**: `d01-q05-remote-history-initial-scope`。相手サーバーの取得可能な
  公開投稿・リポスト履歴を初回から補い、自サーバーに未着の前後の文脈もたどれるようにする。
  [D06](#d06)の投稿履歴取得部分を共通契約・依存とし、関係一覧取得・フォロー等の操作は抱き合わせない。
  相手の公開範囲・取得能力・保存状況に制約され、全peerの完全履歴を保証しない。
  非公開履歴の取得・公開範囲の回避、全件一括取得、常時同期を必要条件にしない。
- **target repo 別分割**: ShuttlePub で起点前後のユーザー投稿・リポストの取得範囲、順序・ページングの
  契約を確認する候補。D06と共通のリモート投稿履歴取得契約を分ける。
  frontends で投稿詳細の下側無限スクロール・上側ボタン取得、部分取得等の状態表示を扱う候補。
- **最小受付・検証案**: 起点の前後に投稿・リポストがある例を使い、過去は下へのスクロール、
  新しい方は上のボタン押下で取得され、読者が大きな負担なく文脈をたどれるか確認する。
  AがBの投稿をリポストした後でAが独り言を書いた例で、そのリポストを開き、上側ボタンから
  Aの後続投稿をたどれることを確認する。
  対応peerの未着の公開投稿・リポストが補完されて文脈をたどれる例を含める。
  取得不能・部分取得・終端を区別し、未取得を履歴なしと誤表示しないことを確認する。
  作者への通常 RT 表示や特殊な通知・専用引用配送は合格条件にしない。
- **依存**: ユーザーの投稿・リポスト履歴取得、閲覧権限、順序・ページング、投稿詳細の表示契約。
  D06と共通のリモート投稿履歴取得部分を依存とし、D06の関係一覧・フォロー操作全体は依存にしない。
  専用引用配送や特殊な作者通知を必須依存にしない。
- **設計・検証が必要な事項**: 取得件数・カーソル・境界・重複・同時刻・リポスト時刻、
  読み込み中・失敗・終端表示、viewport位置保持、ボタン再取得時の具体挙動。
  誰のどのリポストから開いたかを画面遷移と取得APIで保持し、起点時刻・活動ID・カーソル等を設計する。
  原投稿の作成時刻ではなくリポスト時刻を使う等の詳細はユーザー決定にしない。
  リモート取得方法・対応peer・ページング・キャッシュ・失敗時の再取得、取得不能・部分取得・終端の
  区別を設計・検証する。補完時も活動文脈と上下導線を維持し、重複・順序崩れ・起点喪失を検証する。
  製品別API・ActivityPub・スクレイピング等の具体手段を採用した記録ではない。
- **未決事項**: リポストの文脈がない直接リンク、元作者への任意の履歴切替、複数回リポスト等の境界事例。
  原案の時系列的前後取得・リンクを自動引用にしない方式も履歴として保持する。
  特別な作者表示・通知、秘密保持、明示的な紐付けを追加要件にしない。
- **既存との関係**: 投稿詳細・ユーザー履歴の既存基盤を確認し、必要な拡張範囲を判断する。
  [初動決定](../decisions/2026-08-29-initial-shaping.md) D5/D7 の語彙・機能を尊重する。
  D13の引用・リポスト等の許可分類との対応は、D01で操作を追加する方式を選ぶ場合に、その意味が決まった後で統合確認する。

<a id="d02"></a>

## D02 — media-reuse-license

- **意図**: [I02](../product/social-experience.md#i02)。添付画像について他者が利用できる範囲を作者が示す。
- **仮 slug**: `media-reuse-license`。
- **target repo 別分割**: Booskiff のファイルメタデータを第一候補とするが、先に
  ShuttlePub とファイル単位 / 投稿添付単位の責務・参照契約を決める。
  後続は Booskiff の保存 API、ShuttlePub の添付・連合写像、frontends の指定・表示に分ける。
- **最小受付・検証案**: 許諾を指定した画像を添付し、閲覧側で同じ内容を確認できる。
  同じファイルを異なる投稿で使った場合の扱いを契約例で検証する。
- **依存**: Booskiff ファイル参照・メディア添付契約。D11 とメタデータ構造を共有できるか確認する。
- **未決事項**: CC BY ND は既定値の案で、版・適用単位・既存画像への適用は未決。
  外部配送形式、後からの変更、指定できる権限と利用範囲の語彙も未決。
- **既存との関係**: [Booskiff の使命](../../booskiff/identity/mission.md) のファイル管理を候補根拠にする。
  公開 / 非公開のアクセス制御と利用許諾は別の属性として契約を詰める。

<a id="d03"></a>

## D03 — quick-reaction

- **意図**: [I03](../product/social-experience.md#i03)。毎回選択画面を開かず、設定した絵文字で 1 操作リアクションする。
- **仮 slug**: `quick-reaction`。
- **target repo 別分割**: frontends の設定・投稿上のボタンを第一候補。
  端末間同期等で必要になれば ShuttlePub に設定保存 API を独立候補として切る。
- **最小受付・検証案**: 設定済み絵文字が 1 操作で送信され、未設定時や送信失敗時の状態が分かる。
  キーボード操作でも同じ導線を確認する。
- **依存**: 既存 reaction API、SNS UI の投稿表示。
- **未決事項**: 設定の保存先、解除・再送の操作、利用不能な絵文字へ変化した場合の挙動。
- **既存との関係**: Note reaction の操作短縮。D09 のリモート絵文字対応を必須依存にしない。

<a id="d04"></a>

## D04 — note-search-author-filter

- **意図**: [I04](../product/social-experience.md#i04)。投稿検索を特定の投稿者に絞り、少なくとも 1 ユーザーを対象にできる。
- **仮 slug**: `note-search-author-filter`。
- **target repo 別分割**: ShuttlePub の投稿者条件付き検索契約・検索投影候補、frontends の条件入力・結果表示候補。
- **最小受付・検証案**: 同じ語を含む複数投稿者の投稿を用意し、指定した 1 actor の閲覧可能な投稿だけを返す。
  該当なし・ページ境界でも条件が維持されることを確認する。
- **依存**: 投稿検索・永続化 / 検索投影方針、actor 識別、閲覧可否の適用。
- **未決事項**: ローカル / リモートの検索対象、全文検索の方式、複数ユーザー条件。
  ローカル限定検索は原文中の他製品の追記であり、この候補の必須条件にしない。
- **既存との関係**: 既存 timeline の取得と検索を区別し、検索基盤が必要なら別 packet に分割する。

<a id="d05"></a>

## D05 — view-history

- **意図**: [I05](../product/social-experience.md#i05)。一度開いた投稿へ後から戻れるようにする。
- **仮 slug**: `view-history`。
- **target repo 別分割**: frontends の履歴記録・再訪画面を第一候補。
  アカウント同期を必要とする場合のみ ShuttlePub の履歴保存・取得契約を先行候補へ追加する。
- **最小受付・検証案**: 明示的に開いた投稿が履歴へ入り、再表示できる。
  削除済み・閲覧不可へ変わった投稿を開く場合の結果も確認する。
- **依存**: 投稿詳細画面、安定した投稿 ID、保存先の決定。
- **未決事項**: 「開いた」の判定、保持期間、削除・停止操作、端末間同期。
  日付・キーワード・投稿者・メディアタイプの絞り込みは追加候補として段階分割する。
- **既存との関係**: D04 の検索契約は必要なら再利用するが、全投稿検索と個人履歴検索を混同しない。

<a id="d06"></a>

## D06 — remote-discovery-and-actions

- **意図**: [I06](../product/social-experience.md#i06)。自鯖を離れず他鯖の過去投稿・
  フォロー / フォロワー詳細を見て、自分の identity からフォローやスター等を実行する。
- **仮 slug**: `remote-discovery-and-actions`。
- **target repo 別分割**: Emumet のリモート actor・関係一覧取得契約を先行候補にし、
  ShuttlePub のリモート投稿取得・reaction 等の操作候補、frontends の統合導線を分ける。
- **最小受付・検証案**: 対応 peer を 1 種選び、ページ付き関係一覧・過去投稿の取得と
  自 actor による操作を確認する。取得不能・部分取得・古い情報を区別して表示する。
- **依存**: Emumet の既存 actor / follow / followers / following と署名契約、Note 連合接続。
- **未決事項**: 取得範囲・更新頻度、相手の公開範囲、API 差異、サーバー / クライアントの取得責務。
  ShuttlePub 同士の相互通信、製品別 API、最終手段のスクレイピングは原案の方式仮説で、採用未決。
  原文の API パスや取得可能性を実装前に検証する。
- **既存との関係**: [Emumet の責務](../../emumet/product/overview.md) と既存関係 API を再利用する。
  新しい共通 actor 管理や独立した follow 基盤を SNS 側に作る前提にしない。

<a id="d07"></a>

## D07 — note-edit-federation

- **意図**: [I07](../product/social-experience.md#i07)。投稿を編集し、ActivityPub 互換性を考慮して変更を連合先へ反映する。
- **grillでの希望と技術確認**: [正規記録](../interviews/discord-feature-grill-2026-10-15.json)の
  `d07-q01-attachment-edit-feasibility`。添付変更までできることへの条件付き希望・技術質問であり、
  Aを確定選択した回答とは扱わない。[ActivityPubのUpdate](https://www.w3.org/TR/activitypub/#update-activity-inbox)と
  [Mastodon編集API](https://docs.joinmastodon.org/methods/statuses/#edit)等から添付一覧更新は仕様上可能と判断する。
  Mastodon main `861eb7892ad32abad8263805058a052eec169156`の受信処理・NoteSerializerにも対応実例を静的確認したが、
  ShuttlePubとの相互運用試験は未実施。詳細な根拠は正規記録に保持する。
- **履歴提供の採用方針**: `d07-q03-moderation-only-history`。一般閲覧者には編集した事実のみ表示し、
  旧本文・旧添付の履歴はモデレーション用途の閲覧権限を持つ人だけに提供する。一般画面だけ隠して
  一般APIから旧内容を取得できる状態にはしない。投稿者本人という理由だけで閲覧権限を付けない。
  履歴閲覧の画面・APIに権限確認を設け、投稿可視性・担当範囲と整合させる。非公開投稿の可視性を一律に拡張しない。
  一般閲覧の必要性とモデレーション用途を分ける当面の方針であり、公開済み情報の隠匿保証ではない。
- **履歴比較の根拠と制約**: `d07-q02-edit-history-disclosure-tradeoffs`に版・commit・コード根拠を保持する。
  Mastodonは閲覧可能な本文・CW・添付の履歴をUI/APIで提供し、公開投稿の履歴APIは未認証でも利用できる。
  Iceshrimp JS v2026.5.1は標準画面とは別に可視性確認付きの履歴API、.NET v2026.1.2-betaも
  可視性・PublicPreview条件付きの履歴APIを持ち、Akkoma 3.20.1もUI/APIで履歴を提供する。
  画面非表示とAPI非公開は別。投稿元の非提供方針で、連合先の独立保持・提供まで制御できるとは保証しない。
- **候補の方向・状態**: 本文と添付の追加・差し替え・取り外しを含める方向のcandidateとし、対応peer検証待ち。
  全peer対応や完全互換性を承認済み・実装readyとはしない。queue未登録・issue未公開・仮slug未予約を維持する。
- **仮 slug**: `note-edit-federation`。
- **添付変更の設計案**: 投稿IDを維持し完全な最新版をUpdateで伝え、添付参照を更新する。新画像には新URLを使うことで、
  Booskiffの公開URL immutable契約と整合させる。共有元ファイルの上書き・自動削除・他投稿への波及は含めない。
  投稿からの取り外し、元ファイル削除、旧版保持・閲覧は分け、外部コピー／キャッシュの消去を保証しない。
- **target repo 別分割**: ShuttlePub の revision・編集権限・ローカル表示更新、Note Update の
  送受信を分ける。EmumetのNote Update受信は未実装で、既存のPerson Update配送とは区別する。
  必要な署名・中継type契約の拡張を独立候補とし、UI編集導線はfrontendsで扱う。
- **最小受付・検証案（未実施）**: ローカル編集後の本文・添付参照とrevisionの整合を確認する。
  本文を非空に保ったfixtureで添付`[A,B] → [B,C] → []`を更新し、対応peerで追加・差し替え・全取り外しが
  反映されるか確認する。古いUpdate・同じactivityの再送で旧状態へ戻らないことと、非対応peerの扱いを契約テストで検証する。
  一般画面・一般APIでは旧内容を取得できず、モデレーション履歴は閲覧権限を確認することを検証する。
- **依存**: Note 送受信契約、更新主体の認証・認可、元投稿の識別。
- **未決事項**: その他の編集可能項目（CW・poll等）・期限、モデレーション履歴の具体的な権限ロール・担当範囲、
  内部保存期間・削除・旧添付ファイル保持、自鯖／リモートの履歴保持範囲、最終編集時刻の一般表示、
  既存反応・引用・通知・検索の再投影。無期限保持や特定の管理者UIは自動採用しない。
  対応peer・versionごとの実測、更新順序・再取得・非対応peer、具体的な署名・中継契約。
  原文の issue comment は設計調査の参考で、特定方式の採用根拠にはしない。
- **既存との関係**: Note 基盤の更新機能。D10/D11 の後変更反映と D17 の版検証へ共通契約を提供する候補。
  D13の許可設定変更の無期限・受理済み反応維持は、本文編集へ自動適用しない。

<a id="d08"></a>

## D08 — personal-domain-controls

- **意図**: [I08](../product/social-experience.md#i08)。サーバー防御の全体ブロックとは別に、個人がドメイン単位で自衛できる。
- **仮 slug**: `personal-domain-controls`。
- **target repo 別分割**: Emumet の個人ドメイン方針保存・取得候補、ShuttlePub の投稿フィルタ候補、
  frontends の設定・適用状態表示候補。先に API と対象 identity の契約を決める。
- **最小受付・検証案**: A が指定したドメインの投稿が A の閲覧から除かれ、B の設定には影響しない。
  解除後の表示と timeline / 検索等の対象面を検証する。
- **依存**: Emumet の既存 block/mute と権限、ShuttlePub の閲覧経路への適用。
- **未決事項**: block と mute の差、サブドメインの一致規則、boost 経由・通知・既存 follow の扱い。
- **既存との関係**: 既存のユーザー対象 block/mute をドメイン粒度へ拡張する候補。
  [frontends 側の既存要求](../../ratcap/features/block-mute/requirements.md) と統合し、全体ブロックを置換しない。

<a id="d09"></a>

## D09 — remote-emoji-reaction-reuse

- **意図**: [I09](../product/social-experience.md#i09)。他鯖のカスタム絵文字で付いたリアクションに、同じ絵文字で便乗できる。
- **仮 slug**: `remote-emoji-reaction-reuse`。
- **target repo 別分割**: ShuttlePub の絵文字 identity・取得 / 利用条件・連合 reaction 表現候補、
  frontends の既存リアクションからの操作候補。Emumet の配送契約変更が必要なら分割する。
- **最小受付・検証案**: 名前が同じでドメインが違う絵文字を区別し、選んだものと同じ identity で反応できる。
  利用不能 / 取得不能な絵文字の扱いも確認する。
- **依存**: 既存 reaction、カスタム絵文字の参照と Note 連合接続。
- **未決事項**: 外部絵文字の利用許可、キャッシュ・削除、相手側の表現差。Akkoma で可能という原文情報は調査対象。
- **既存との関係**: reaction 基盤の拡張。D03 の短縮操作とは別候補として扱い、後から接続できる。

<a id="d10"></a>

## D10 — sensitive-content-policy

- **意図**: [I10](../product/social-experience.md#i10)。閲覧注意の二択を越えて種類別に表示を選び、後からの変更も連合先へ反映したい。
- **仮 slug**: `sensitive-content-policy`。
- **target repo 別分割**: ShuttlePub の分類・閲覧判定・互換 fallback 契約候補、
  frontends の分類指定・閲覧設定候補。必要な更新配送を D07 / Emumet 接続へ分割する。
- **最小受付・検証案**: 少数の分類で閲覧設定に従った表示になること、分類を変更した後に
  ローカル表示と対応 peer の受信内容が更新されることを確認する。
- **依存**: D11 の画像タグとの共通語彙、D07 相当の更新配送契約。
- **未決事項**: 分類の管理者・自由入力の有無、投稿 / 画像への適用単位、非対応 peer への CW 写像。
- **既存との関係**: D11 はメタデータ付与、D10 は閲覧方針と更新反映を担う候補。
  別々のセンシティブ分類モデルを作らず、先に共通契約を詰める。

<a id="d11"></a>

## D11 — media-tagging

- **意図**: [I11](../product/social-experience.md#i11)。画像に複数の任意タグを付け、
  通常タグとセンシティブタグを区別する。既存タグの補完も欲しい。
- **仮 slug**: `media-tagging`。
- **target repo 別分割**: Booskiff メタデータを第一候補とし、ファイル単位 / 投稿添付単位の
  保存・上書き・更新伝播契約を ShuttlePub と先に決める。保存 API、ShuttlePub の
  連合 CW 写像、frontends の付与・補完 UI を独立候補に分ける。
- **最小受付・検証案**: 複数の通常 / センシティブタグを保存・再表示できる。
  通常タグを独自の外部必須仕様にせず、センシティブタグ名が外部向け CW へ入る契約例を検証する。
- **依存**: メディア添付参照、D02 と共有するメタデータ責務、D10 の分類・D07 の更新契約。
- **未決事項**: タグの共有範囲・正規化・補完辞書、参照中ファイルへの変更、複数画像の CW 集約。
  相手鯖が通常タグを実際に無視することは保証せず、送信表現を決める。
- **既存との関係**: Booskiff ファイル管理の拡張候補。投稿 hashtag と画像タグの区別を維持する。

<a id="d12"></a>

## D12 — contextual-content-guidance

- **意図**: [I12](../product/social-experience.md#i12)。投稿・検索内容に応じて案内やリンクを示し、
  必要な場合は投稿キャンセルや検索の制御を行う。支援先案内や災害時の誤誘導抑止等が原案の用途。
- **仮 slug**: `contextual-content-guidance`。
- **target repo 別分割**: ShuttlePub のルール評価・案内 / 拒否結果・適用面の契約候補、
  frontends の案内と確認導線候補。管理権限は必要時に Emumet の既存権限と接続する。
- **最小受付・検証案**: テスト用の明示ルールを 1 件設け、案内だけの場合と操作拒否の場合を区別して確認する。
  UI を経由しない投稿 / 検索でも、確定した強制ルールが同じように適用される。
- **依存**: 投稿受付・D04 等の検索契約、運用ルールの責任者と管理権限。
- **未決事項**: 検出方法、対象・例外、誤検出時の救済、リンクの管理、利用者 / 管理者の裁量。
  原文の例示をそのまま違法性判定や禁止語仕様へ変換しない。
- **既存との関係**: moderation の権限を再利用し、外部の支援先情報は導入時に別途検証する。

<a id="d13"></a>

## D13 — interaction-allowlists

- **意図**: [I13](../product/social-experience.md#i13)。投稿ごとに反応を許可する人を指定し、
  対象外の人にも許すアクションの範囲を選びたい。重要情報発信・企業公式アカウント等も想定する。
- **候補の状態**: 主要な利用意図は整理済み。連合契約は調査待ちで、互換性・技術契約の検証前に
  実装readyとはしない。candidate・queue未登録・issue未公開・仮slug未予約を維持する。
- **仮 slug**: `interaction-allowlists`。
- **target repo 別分割**: ShuttlePub の policy・投稿操作 / 受信時の適用契約候補、
  frontends の指定・反応可能状態の表示候補。必要時は Emumet の関係状態との接続を分ける。
  リスト追加枠の課金・認定とBooskiff課金連携は初回の必須依存にしない。
- **grillで採用済みの方針**: [正規記録](../interviews/discord-feature-grill-2026-10-15.json)を根拠とする。
  - `d13-q01-allowlist-subject` / `d13-q02-allowlist-selection`: 対象は人。
    個別指定と関係条件の両方を使い、対象外の人に許すアクションも別に設定する。
  - `d13-q04-list-reuse` / `d13-q05-initial-scope`: 許可専用の名前付き保存名簿は不要。
    個別指定と関係条件で先行し、タイムライン用リストの再利用は後続とする。
    その新規実装や契約の完了を初回提供の必須依存にしない。
  - `d13-q06-membership-evaluation` / `d13-q07-audience-union`: 条件と個別指定はOR。
    関係は反応時点の最新状態で判定し、どれにも該当しない人には対象外向けの操作設定を適用する。
  - `d13-q09-policy-mutation-decision`: 設定変更に期限を設けず、投稿元が新規操作の受理時に
    最新設定と関係状態で最終判定する。外部には変更を通知し、取得済み設定を事前表示に使える。
    毎操作の外部追加GETは正当性の必須前提にしない。古い設定から送られた操作にも投稿元の
    最終判定を適用し、自鯖の受理・通知・集計・表示を制御する。
    非対応peerの独自表示まで阻止する保証とは区別し、対応peer間の承認契約は別途詰める。
  - `d13-q10-existing-interactions`: 受理済みの返信・引用・リポスト・リアクションは維持する。
    許可設定や関係の変更で自動取消し・非表示・集計除外せず、過去の一斉再判定や取消し配信も行わない。
    最新判定は新規操作に適用する。同一activityの再送は冪等に扱い、設定変更だけで既存受理を覆さない。
    個別削除・通報・モデレーション・ブロック等の別機能の仕様は、この決定では変更しない。
  - `d13-q11-unrestricted-default`: 反応制限を未設定の投稿では、閲覧できる人に返信・引用・リポスト・
    リアクションをすべて許可し、通常の投稿に許可設定を必須としない。
    閲覧権限を追加したり、公開範囲・ブロック等の別の制約を解除したりはしない。
  - `d13-q12-allowed-audience-actions`: 制限を付けた投稿でも許可対象内の人には返信・引用・リポスト・
    リアクションをすべて許可する。操作別トグルは対象外の人にだけ適用し、対象内向けには設けない。
    この全許可も、閲覧権限・ブロック・モデレーション等の別の制約を解除しない。
  - `d13-q13-four-action-categories`: 対象外に許す操作は返信 / 引用 / リポスト /
    リアクション（いいね＋絵文字）の4分類とし、それぞれ独立したON/OFFトグルで選べる。
    いいねと絵文字には同じ許可を適用し、別々の許可設定は設けない。
    許可項目の共通化は、連合の通信形式や保存するリアクション情報の違いを失わせない。
    調査・提案の経緯は`d13-q03-action-toggles`に保持する。
  - `d13-q14-previous-post-settings`: 新規投稿の反応制限は前回の投稿の設定を引き継ぐ方向とする。
    投稿ごとの設定を引継ぎ元とし、別途アカウント既定値を編集・保存する手順を前提にしない。
    別管理のアカウント既定設定や名前付きプリセットを追加する承認ではない。
  - `d13-q15-settings-by-post-kind`: 通常投稿・返信・引用の3種類ごとに前回の反応制限設定を覚え、
    新規投稿には同じ種類の設定を引き継ぐ。返信の設定を次の通常投稿へ持ち越すなど、
    種類間で引継ぎ元を共用しない。
  - `d13-q16-initial-relationship-conditions`: 初回の関係条件は投稿者がフォローしている人・
    投稿者のフォロワー・相互フォローの3種類とする。相互は投稿者と操作する人の双方向のフォロー成立を指す。
    条件同士と個別指定の結合はOR、関係評価は新規操作の受理時点の最新状態とする方針を維持する。
    将来の条件追加を禁止せず、タイムライン用リストの再利用は後続のままとする。
  - `d13-q17-list-quota-billing-scope`: 原案の保存リスト枠3〜5個と追加枠の月額課金・公式認定は初回範囲から外す。
    この課金・認定やBooskiff課金連携を初回提供の必須依存にしない。原案は履歴として保持し、将来の採否は未決。
    3〜5を個別指定人数・投稿数・投稿種別の記憶枠・タイムライン用リスト等の上限へ転用しない。
    技術的な件数上限・レート制限・濫用対策の必要性や数値は別途設計する。
  - `d13-q18-restricted-outsider-default`: 引き継ぐ設定がなく初めて反応制限を有効にする場合、
    対象外向け4トグルはすべてOFFから始め、許したい操作を投稿者がONにする。
    制限未設定時と許可対象内の全許可は維持する。同種の前回設定があれば引き継ぎ、毎回OFFへ戻さない。
    履歴なしの新規投稿で自動的に制限を有効にする決定ではない。
  - `d13-q19-individual-list-visibility`: 個別に許可した人の一覧全体は他の閲覧者・peerへ公開・配布しない。
    操作する人には自分の反応可否を示し、投稿者は自分の一覧を確認・変更できる。
    明示的な一覧公開についての決定であり、操作結果等から対象者・関係を推測できない保証ではない。
    一覧を渡さずに可否を伝える方式は、変更通知・取得済み情報の事前表示・投稿元の最新判定と
    毎操作の外部追加GETを必須にしない方針と両立させる。
- **最小受付・検証案**: 対象と操作種別を明確にした policy 例で、reply / quote / turbo / reaction 等の
  許可・拒否を API と UI で一致させる。
- **連合契約の調査・検証が必要な事項（未実施）**: 4操作のpolicyと各peerの通信表現・承認方式の
  対応表を作る。更新通知の遅延・欠落・逆順、関係変更、設定変更と新規操作の競合、activity再送、
  受理結果の伝達をfixture等で検証する。非対応peerの独自表示が保証外であることと、一覧を配布せず
  本人の可否を伝えられること・未確認時の扱いも契約例で確認する。調査・検証の実施済みや実装packet化を意味しない。
- **依存**: 反応の各コマンド、Note 連合受信、認証・認可、最新の関係状態を参照する契約。
- **未決事項**: 「前回」に投稿成功・下書き・取消・投稿後編集のどれを含めるか、返信かつ引用の分類、
  端末間共有・保存場所・投稿画面への反映時点、制限切替時の一時設定保持・許可対象未選択時の扱い、
  フォロー申請中・ブロック等を含む関係状態の具体的な判定契約、関係条件ラベルの表示範囲・管理者の参照／監査、
  一覧を渡さず本人の可否を伝える通信方式・未確認／判定待ち表示、
  公開範囲・block/mute等との統合、policy表現・版管理・連合承認契約と
  非対応peerの詳細。後続タイムライン用リストの所有・公開・更新・再利用契約も未決。
  原案の絵文字だけ誰でも可、リポスト・いいねだけ可は履歴として保持するが、
  現在の許可モデルではいいねと絵文字を区別しない。
- **既存との関係**: 個人 block/mute とは別の投稿 policy 候補。
  [Booskiff のみを課金ポイントとする既存方針](../../booskiff/identity/mission.md) と
  SNS 機能の課金案の整合は将来再検討時の制約として保持し、今回その方針変更や課金実装を確定しない。

<a id="d14"></a>

## D14 — cross-server-moderation-evidence (調査候補)

- **意図**: [I14](../product/social-experience.md#i14)。悪質ユーザーに関する情報を公開する際、
  その証跡が当該ユーザーの投稿に対応することを外部から検証し、サーバーを越えるモデレーションに使いたい。
- **仮 slug**: `cross-server-moderation-evidence-research`。
- **target repo 別分割**: 実装 packet ではなく共同契約の調査候補。Emumet の identity / 署名と
  ShuttlePub の投稿来歴のどちらが何を証明するかを整理後、primary domain と target repo を決める。
- **最小受付・検証案**: 誰が何を検証できるのか、悪意ある送信元も含む脅威モデル、証拠能力の限界、
  データ公開・照合の影響と代替案を文書化し、採用 / 不採用 / 継続調査の判断材料を揃える。
- **依存**: 投稿元情報の取得主体、署名・証跡の信頼モデル、運用上の公開・検証手続き。
- **未決事項**: 投稿元 IP のハッシュを連合へ載せる案と BLAKE3 は方式仮説であり採用未確定。
  IP の候補列挙による照合、共有 IP / 動的 IP、偽の入力、投稿との対応を何が保証するかを検討する。
- **既存との関係**: 既存 HTTP 署名が投稿元 IP や主張の真実性まで保証するとは扱わない。
  D17 の内容同一性とは証明対象を分ける。調査完了前に公開フィールドを追加しない。

<a id="d15"></a>

## D15 — registration-readiness-gate

- **意図**: [I15](../product/social-experience.md#i15)。メール認証・CAPTCHA 等の対策準備が整わないまま
  新規登録を一般開放し、スパム BOT の踏み台となることを防ぐ。
- **仮 slug**: `registration-readiness-gate`。
- **target repo 別分割**: Emumet と Ory の設定責務・readiness 契約を先行候補にする。
  開放 API / 実際の登録経路の gate と、frontends の管理 UI・不足条件表示を分ける。
- **最小受付・検証案**: 必須条件を欠く設定では一般開放が拒否され、条件が揃えば開放できる。
  設定変更後と UI を経由しない登録の入口でも整合することを確認する。
- **依存**: [認証を Ory へ委譲する決定](../../emumet/decisions/0001-stellar-frozen-ory-authz.md)、
  登録設定の実際の管理主体と管理者権限。
- **未決事項**: 必須対策の組合せ、設定済みと稼働確認済みの違い、開放後に条件を失った場合、
  招待登録・セルフホストでの扱い。メール認証と CAPTCHA を無条件に両方必須とは決めない。
- **既存との関係**: ShuttlePub に認証基盤を新設せず、Emumet / Ory の登録・管理設定へ接続する候補。

<a id="d16"></a>

## D16 — tag-report-and-trend-moderation

- **意図**: [I16](../product/social-experience.md#i16)。複数鯖をまたぐ荒らしに使われるタグを通報し、
  自動または手動でトレンド掲載を下げられるようにする。
- **仮 slug**: `tag-report-and-trend-moderation`。
- **target repo 別分割**: ShuttlePub のタグ通報・審査記録候補とトレンド抑制投影候補、
  frontends の通報 / 審査 UI 候補。Emumet は必要時に既存の管理権限を提供する。
- **最小受付・検証案**: タグを通報し、管理者の抑制判断後に対象タグのトレンド掲載へ反映される。
  原投稿の削除とトレンド抑制を区別し、解除後の扱いも確認する。
- **依存**: hashtag の識別、トレンド生成契約、管理者 / moderator 権限。
- **未決事項**: タグ正規化、自動判定の閾値、虚偽・大量通報、抑制期限、適用範囲。
  トレンド基盤が必要なら先に独立 packet にし、自動抑制は手動経路から分割できる。
- **既存との関係**: 画像タグ D11 と区別する。既存アカウント通報の有無だけでタグ通報の完成を判断しない。

<a id="d17"></a>

## D17 — turbo-content-verification

- **意図**: [I17](../product/social-experience.md#i17)。turbo した人が当時見た元投稿と、
  turbo を見る人に現在表示される投稿が同じ内容かを検証できるようにする。
- **仮 slug**: `turbo-content-verification`。
- **target repo 別分割**: ShuttlePub の対象 revision / 内容 commitment・検証結果契約候補、
  必要時 Emumet の署名契約候補、frontends の同一・変更・検証不能表示候補。
- **最小受付・検証案**: 同一内容、編集済み、削除 / 取得不能、署名を持たない外部投稿の例で、
  同一性の確認結果と検証不能を区別する。本文以外に何を比較するかを固定して検証する。
- **依存**: D07 の revision / 更新モデル、turbo 基盤、Note 連合の識別・配送契約。
- **未決事項**: 元投稿の署名を載せる案の実現可能性、正規化と署名対象、添付等の対象範囲、
  過去版の保持、署名鍵変更、比較時点。HTTP 配送署名と永続的な内容証明を同一視しない。
- **既存との関係**: 既存 turbo を版と結び付ける拡張候補。D14 の IP 証跡とは独立して調査できる。
