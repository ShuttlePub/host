# 2026-11-21 Emumet の P1 以降の未決事項とサービス間契約の整理 (D51-D60)

2026-11-21 に operator と確定した決定、および既存の決定から導かれる契約・方針の記録。
[2026-11-20-problem-domain-and-producers.md](2026-11-20-problem-domain-and-producers.md)
の続きで、番号を引き継ぐ。

きっかけは、[2026-11-18-p1-first-and-stellar-carve-out.md](2026-11-18-p1-first-and-stellar-carve-out.md)
(D36-D41) で未決として残した「転送時の認証方式」「Ory 停止中に保証する範囲」「D32 の対応表と D38 の境界」と、
P1 以降の実行単位を進めるうえで整理が必要だった Emumet 側の未決事項 (a〜j の 10 件) の棚卸し。

## 決定 (operator 判断)

| # | 決定 | 内容 | 状態 |
|---|------|------|------|
| D51 | 転送時の認証と Ory 停止中の範囲 (c) | Emumet → ShuttlePub の内向き転送リクエストは、Emumet のサーバー単位の鍵 (Profile の鍵ではない) で署名し、ShuttlePub が Emumet のドメインから公開鍵を取得して検証する。これにより受信・キュー・転送・ShuttlePub での保存は Ory に依存しない (Ory 停止中に止まるのはログイン・同意・新しい link の登録だけ)。再送は D30 の 72 時間に揃える。受け付ける Emumet は、P1 では ShuttlePub 側の設定で、P2 以降は link の有無で決める | 確定 |
| D52 | DCR の境界と P1 の範囲 (e) | P1 では DCR を実装しない。P1 で行うのは、境界の規則を決めることと、既存のログイン・同意のコードをモジュールとして分けることまでとする (D38)。認証のまとまり (将来の Stellar) には Hydra / Kratos との連携、`/oauth2/login`、`/oauth2/consent`、P2 で足す DCR の受付と対応表を置く。Emumet 本体には Account、Profile、鍵、フォロー関係、link を置き、呼び出し元を「検証済みの origin」か「検証済みの subject」としてだけ見る。JWT の検証は Emumet に残す。link は ShuttlePub の origin だけを持ち、OAuth の `client_id` は持たない。対応表をどちらが持つかは、P1 の後の Stellar の設計 (D36) で Stellar の配置と一緒に決める。既存の `AuthAccount.client_id` は Kratos の identity で OAuth の client とは別物のため、新しい表では列名を分ける。DCR を最初に使うのは P2 の署名 API | 確定 |
| D53 | Emumet の dev イメージ公開の開始時期 (f) | D35 の「dev からコミット SHA と `dev` のタグで公開」は、Emumet では初回リリースと同時に `dev` ブランチを新設してから始める。まだ一度もリリースしておらず今は使える状態ではないため、それより前に dev イメージを作る動機がなく、初回リリースまでは dev イメージを公開しない。P1 の連合 E2E (D35) で Emumet のイメージが必要になる場合の用意の仕方 (ソースからビルドするなど) は、E2E の設計で決める未決事項として残す | 確定 |

### D51 の検討の経緯と Emumet の現状

- **なぜ送り主 (Emumet) の確認も要るか**: operator から「Activity の中身が正しいかだけ確かめれば足りるのでは」と問われ、次の 4 点から送り主の確認も必要と整理した。
  1. 転送には Emumet にしか言えない情報 (どの Profile 宛てに届いたか、フォロワー限定の宛先、link の世代、受信 ID) が付く。
  2. 72 時間の再送の間に、元の署名の日時が多くの実装の許容範囲を外れる。
  3. 相手の鍵の変更や削除で、元の署名を確かめられなくなる。
  4. 相手の鍵の取得が二重になる。
- **再検証の余地**: そのうえで、元の署名ヘッダと受信したままの本文は envelope (D54) に残し、ShuttlePub があとから元の署名を検証し直す選択肢を残す。
- **Emumet の現状**: Emumet の最新 `main` (`1259c731`) には、サーバー単位の鍵も instance actor もない (actor も鍵も Profile 単位で、`profile_signing_keys` に保存)。そのため P1 で、サーバー鍵の生成と公開も作る必要がある。

## 既存の決定から導かれる契約・方針

| # | 決定 | 内容 | 根拠 | 状態 |
|---|------|------|------|------|
| D54 | 内向き転送の envelope (a) | 外側に版番号、receipt ID (再送でも変わらない)、受信時刻、宛先 (Profile の actor URL、link ID、generation)、検証結果、元の署名関連ヘッダを持たせ、本体は受信したままの本文 (バイト列) を入れる。1 つの envelope に宛先の Profile は 1 つ。重複除去は 2 段 (投稿の本体は Activity の `id`、宛先は「`id` と宛先 Profile」の組)。再送の分類は 2xx を成功、5xx・タイムアウト・401・408・429 を再送 (間隔と上限は D30)、ほかの 4xx を打ち切りとして監査記録に残す。順序は保証しない。転送の種類は Emumet 側で絞らない (Follow 系と Block 系以外は全部渡す)。link のない Profile 宛ては保留せず、恒久失敗として監査記録に残す (記録の粒度は設計で決める) | D12・D23・D29・D30、emumet ADR 0003、`intents/emumet/features/post-relay/requirements.md`・`decisions.md` (2026-08-25) | 確定 |
| D55 | ダイレクトと信頼モード②の転送先 (b) | P1 ではすべてホーム (③) へ転送する。ダイレクトは常にホームだけ。P2 の設計時に、ユーザーに次の 1 問を確認する:「信頼モード②の link へ転送するのは、その link の名前空間の投稿への返信・反応・リポストだけでよいか」(推奨は「はい」) | D26・D31、service-concept 柱 4、emumet ADR 0002 (2026-11-18 追記) | 確定 (P2 確認事項あり) |
| D56 | ホームの link の最小部分 (d) | Profile ごとの link レコード (link ID、Profile、ShuttlePub の origin、信頼モード (P1 は③だけ)、generation、状態、解除理由) を持つ。③は Profile ごとに 1 つまでという DB 制約を付ける。登録は本人が認証して呼ぶ API で行う (UI は P2)。P1 の間は、登録できる origin を運営者が設定した一覧に限る。既存の E2E は Kratos 経由でアカウントを用意しているので、本人による API 登録で E2E を書ける | D28・D31・D40、emumet ADR 0002・0003、`intents/emumet/features/post-relay/decisions.md` (2026-08-25) | 確定 |
| D57 | 署名 API のバッチの形 (g) | Profile と link 単位の新しい経路として作る (Account 単位の旧 `/internal/v1/accounts/{id}/sign` は 410 Gone で廃止済み)。入力は link、body を 1 回、inbox URL の並び。出力は宛先ごとの結果で、1 件の失敗でバッチ全体を失敗にしない。1 回の件数の上限は負荷試験で決める | D27・D33、emumet ADR 0003、`intents/emumet/decisions/profile-federation-in-place-reset.md` | 確定 |
| D58 | 配送用のフォロワー一覧 API (h) | 配送先の inbox URL の集合を返す API (`sharedInbox` を優先し、重複を除いたもの。①の link にも出す) と、ホーム向けのフォロー関係の API を分ける。ページングはカーソル方式。前提として、Emumet は今 `sharedInbox` を受け取りも保存もしていないので、その取得と既存データの埋め直しが必要 (P3) | D27・D28・D31・D33、service-concept 柱 3 | 確定 |
| D59 | Profile 移管時のメディアコピー契約 (i) | Booskiff との連携 (P4) までは Noop のままでよい。契約で必要な点として、新しいファイル ID を返すこと、冪等キーを持つこと、承認者のトークンではなくサービスとしての認証にすること (D51 のサーバー鍵を流用できる)、移管先の容量超過の扱いを決めることを記録する | `intents/emumet/interview/2026-08-29-org-accounts-grill.md`、`intents/emumet/decisions/0007-organization-accounts.md` | 確定 |
| D60 | 2026-08-22 修正前の deactivated アカウントの扱い (j) | 2026-08-22 の修正 (`account-unban-reactivate`) より前に紐付けを消された deactivated アカウントは救済しない。本番はまだ動いておらず、救う対象の実データがないため | `intents/emumet/packets/backlog.md` (`account-unban-reactivate` 引き継ぎ事項) | 確定 |

## 前回調査の訂正

- 2026-11-18 時点の調査で「Account 単位の署名 API (`POST /internal/v1/accounts/{id}/sign`) がある」としていたのは誤りで、その経路は 410 Gone で廃止済み (Emumet `server/src/route/retired.rs`、`intents/emumet/decisions/profile-federation-in-place-reset.md`)。署名 API (D33・D57) は既存経路の拡張ではなく、Profile と link 単位の新しい経路として作る。

## 今回の決定に含めないもの (未決)

- **P1 連合 E2E での Emumet イメージの用意の仕方** (D53)。初回リリース前は `dev` イメージを公開しないため、E2E の設計でソースからのビルドなどの方式を決める。
- **信頼モード②の link への転送範囲の最終確認** (D55)。P2 の設計時に「信頼モード②の link へ転送するのは、その link の名前空間の投稿への返信・反応・リポストだけでよいか」(推奨: はい) を確認する。
- **D32 の対応表の最終的な担当** (D52)。P1 の後の Stellar の設計 (D36) で、Stellar の配置と一緒に決める。
- **link のない Profile 宛ての恒久失敗の監査記録の粒度** (D54)、**署名 API バッチの 1 回あたりの件数上限** (D57)、**移管先での容量超過時の扱い** (D59)。各実行単位の設計・負荷試験で決める。

## 過去の決定との関係

- **D30・D39** (内向き転送は専用 API): 維持。D51 で転送時の認証方式と Ory 停止中の範囲を確定し、D54 で envelope の欄・2 段の重複除去・再送分類を定めた。
- **D31・D40** (ホーム / 参加の link と信頼モード、origin 単位): 維持。D55 でダイレクトと P1 の転送先を定め、D56 で P1 のホーム link の最小範囲を定めた。
- **D32・D37・D38** (DCR、Stellar 切り出し、境界分離): 維持。D52 で P1 の作業範囲 (DCR 自体は P2、P1 はモジュール分離と境界規則まで) と、link が `client_id` ではなく origin を持つ規則を定めた。
- **D33** (署名 API のバッチ化): 維持。D57 で入出力の形と部分失敗の扱いを定めた。
- **D35** (連合 E2E とイメージ公開): 維持。D53 で Emumet の `dev` 公開は初回リリースと同時に `dev` ブランチを新設してから始めることとした。
- **ロードマップ** ([../packets/roadmap-2026-11-18.md](../packets/roadmap-2026-11-18.md)): 先頭の追記欄と P0〜P4 の該当箇所に D51-D60 を反映した。
- **Emumet backlog** ([../../emumet/packets/backlog.md](../../emumet/packets/backlog.md)): `account-unban-reactivate` の引き継ぎ事項に D60 (救済しない) を追記した。

## 追記 (2026-11-21): P1 実装計画 (第 3 版) で確定した事項 (D61-D67)

Emumet の P1 実装計画 (C0・K1・L1・Q1・S1・I1・A1・B1・T1 の 9 単位) の承認にあたり、operator が決めたこと、
その決定から導かれる契約上の規則を記録する。D54 の文言は変えず、下の D63 で除外条件を明確にする。
契約の本文は [contracts/emumet-post-relay/v1.md](../contracts/emumet-post-relay/v1.md) (C0 の成果物)。

| # | 決定 | 内容 | 根拠 | 状態 |
|---|------|------|------|------|
| D61 | 転送契約の正本の置き場所 | 内向き転送の契約 (文書・JSON Schema・fixture・署名ベクトル) の正本は host の `intents/shuttlepub/contracts/emumet-post-relay/` に 1 つだけ置く。Emumet 側 (`docs/contracts/post-relay-v1*`) は host の commit・版・checksum を明記した写しで、独立に編集しない。他 domain (emumet) は参照するだけ。置き場所は `intent-cli guide host-ownership` (design は `intents/<domain>/**` に書ける) と `intent lint-layout` (新しい警告なし) で確認した | 計画 §10.1、`intent-cli guide host-ownership`、`intent-cli intent lint-layout --domain shuttlepub` | 確定 |
| D62 | link 解除と送信開始の境界 (ユーザー決定①、案 A) | link 解除が確定した後は、新しい送信も再送も許可しない。直前に送り始めたものは受け手に届いてよい。「送り始めた」かどうかの境界は、job への送信許可の commit である (commit 前なら解除が勝ち、送らない。commit 後は届いてよい)。期限の起点は commit 時刻ではなく、最終許可更新時の DB 時刻 `authorized_at` で、commit に掛かる時間も 10 秒の枠に含み、commit 後に取り直さない (レビュー指摘で明記、v1.md §9 revision 2)。期限は `authorized_at` からの絶対期限 (初期値 10 秒、自動配送は受信から 72 時間・人手再配送は隔離期限を超えない) で、commit の成否が不明なら送らず、HTTP 送信中は DB の transaction・接続・lock を持たない。解除の経路は所有者の解除 API・退会・Account projector の 3 つで、共通の lock 順序に従う | ユーザー決定①、計画 §5.4 (N2) | 確定 |
| D63 | D54 の「Follow 系と Block 系以外は全部渡す」の除外条件 (ユーザー決定②) | 転送から除外するのは Follow・Block 自体と、**既知の** Follow・Block を確実に参照する Undo・Accept・Reject だけ。参照先が分からない Undo・Accept・Reject (URL だけで未知、object なし、空配列、未知が混ざる配列) は転送する。判定のために object の URL を取得しない。先行 Undo の仮記録は Follow の存在の証拠にしない。`type` が配列のときは、Follow・Block・Undo・Accept・Reject のうち 2 種類以上を含めば 400 で関係を変えず、拡張 type の併記だけでは拒否も除外もしない。判定の詳細は契約の §8 | ユーザー決定②、D54、計画 §4 | 確定 |
| D64 | 恒久失敗と 72 時間打ち切りの 30 日隔離 (ユーザー決定③。ADR 0003 の限定例外) | 恒久失敗と、受信から 72 時間の打ち切りだけ、元の envelope を終端から 30 日間隔離し、本文なしの要約 1 件を同じ 30 日残す。運営者は同じ envelope・receipt・宛先のまま人手で再配送できる (外側の Date と署名だけ作り直す)。成功と取消では job・試行履歴・本文を消し、配送ごとの行を残さない。隔離した本文は投稿の保存・検索・通常の配信に使わない。ADR 0003 の「投稿コンテンツは Emumet に保存しない」は、この隔離を限定例外として維持する (ADR 0003 に追記) | ユーザー決定③、post-relay decisions (2026-08-25) の 72 時間・30 日、計画 §6.3 | 確定 |
| D65 | 移管と退会後の再有効化 (ユーザー決定④⑤) | Profile の移管では link を引き継ぐ (link ID・origin・generation は変えず、以後は新しい所有者だけが操作する)。退会後に再有効化しても link は自動で復活させない。退会は物理削除ではなく退会のイベント・状態遷移で link を失効させ、generation を増やす。再登録は本人が行い、新しい link ID になる。停止・BAN は link を保ったまま送信を保留し、72 時間・30 日の期限は延ばさない | ユーザー決定④⑤、計画 §5.3 | 確定 |
| D66 | P1 の受け手の検証と P2 の分離 | P1 の受け手は link の台帳を持たない。設定済みの Emumet を信頼し、link ID と generation をその申告として扱う。P1 では generation の新旧判定をせず、古い generation を拒否する fixture も作らない。Profile・link・generation・有効性の照合は、信頼できる link 状態を取得できる P2 以降に回し、その fixture は事前状態を明記して P1 から分ける。`received_at` の古さだけでは拒否しない (人手再配送で最大約 33 日前になる) | 計画 §3.3 (N1)、D51・D56 | 確定 |
| D67 | 契約 v1 revision 2: C0 レビューで固めた規則 | (1) 外側署名の対象は実際の method と target から組み立て、`POST` と `/internal/v1/emumet/activities` (query なし) 以外は 405 `method_not_allowed`・404 `not_found` で拒否する。(2) `received_at`・`verified_at` は暦として存在する日時 (範囲は schema、月ごとの日数・閏年は schema の外で `schema_violation`)、URL は authority を host[:port] に限る (host は DNS ラベルの並びで、Punycode の `xn--` のような連続ハイフンを許す。userinfo・IPv6 リテラル・空 authority・不正な port は拒否)。(3) inbox から取り出す actor・Activity ID は `URL_MAX` (2048) 文字以下かつ envelope の URL 形式を満たすこと。actor が満たさなければ 400 `invalid_actor` (Follow/Block を含む全 body に適用)、Activity ID が満たさなければ拒否せず null にして転送する。type の各文字列は `TYPE_STRING_MAX` (512) 文字以下で、超えれば 400 `invalid_type`。(4) ヘッダ証拠の省略は、候補の重複排除・予算に省略名の長さを含める手順・件数の上限 (`OMITTED_COUNT_MAX` 1024) まで含めて、入力と出力の fixture で定める。定数 `OMITTED_COUNT_MAX`・`TYPE_STRING_MAX` を追加し、契約を revision 2 とする | C0 (emumet-p1-relay-contract) の承認レビュー指摘 must 1〜4 と任意 5。(3) の actor 規則を全 body に適用する点と `TYPE_STRING_MAX` の値 (512) は C0 担当の判断で、レビューで異論があれば直す | 確定 (契約 revision 2) |

### 今回の決定に含めないもの

- **退会後の猶予期間と物理削除** (ユーザー決定⑥): 別の課題として `intents/emumet/packets/backlog.md` に残している。link の失効は猶予や物理削除を待たない (D65)。
- **K2** (instance 鍵のローテーション・失効の操作)、P2 の link 状態同期、DCR、dev イメージ公開。
