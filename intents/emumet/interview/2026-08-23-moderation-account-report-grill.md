# Interview: moderation-account-report × Ratcap admin-moderation 横断設計 grill (2026-08-23)

chat-first grill セッションで記録。CLI セッション記録:
`intents/emumet/interviews/moderation-account-report.json` (Q1-Q10)。

契機: emumet backlog #10 `moderation-account-report` が「Ratcap admin-moderation
横断設計の grill 待ち」(2026-08-22 stack) だったものを、オペレーター指示で grill 開始。
依存ユニット `moderation-role-assignment` (issue #45 / PR #48) はマージ済み。

## Q1: 通報対象のスコープは?

**Answer**: A. アカウント単位のみ。投稿(Note)単位の通報は将来必要になった時点で
別 feature・別イベント群として追加する。target は AccountId の uuid 単一とし、
多態化しない。

## Q2: リモートアカウントの通報と AP Flag 連合の扱いは?

**Answer**: B. ローカルアカウントのみ通報可能とする。リモートアカウントの通報・
AP Flag 連合(送信/受信)はいずれも本スコープ外。リモートの問題アカウントへの対処は
将来のホストモデレーション feature で別途設計する。

## Q3: 通報の状態モデルは?

**Answer**: B. 3状態モデル: open / resolved(対応済み・アクション実施) /
dismissed(却下)。クローズ時に分類を必須化し、close_reason テキストも従来通り必須。
担当者アサイン機能は入れない。

## Q4: 通報の type(カテゴリ)の設計は?

**Answer**: A. 列挙カテゴリ必須 + 自由コメント。初期カテゴリは
spam / harassment / other の3つ。列挙の追加は後方互換の拡張として後から行う。
comment は other 選択時のみ必須、それ以外は任意。

## Q5: 通報ハンドリング(一覧・状態遷移)の権限は?

**Answer**: A. 既存の instance_moderate permit を流用。Admin + Moderator の両方が
通報の一覧取得・状態遷移(resolve/dismiss)を実行可能。Keto 側の変更なし
(Keto `moderate` permit は既に admins + moderators 包含、namespaces.ts)。
通報の作成は認証済みローカルユーザー全員が可能。
Ratcap 側は GET /api/v1/me の instance_roles で UI 出し分け。

## Q6: AccountReport の永続化方式は?

**Answer**: A. ES aggregate。AccountReport aggregate + イベント
(account_report_created / account_report_closed) + tailing projector +
read projection DTO。ADR 0006 の確立済みパターンに従う。
docs 案の account_report_updated(通報者による事後編集)はイベントから外し、
通報は作成後 immutable・クローズのみ可能とする。
状態は Q3 の open/resolved/dismissed、クローズイベントは resolution 分類 +
close_reason を持つ。

## Q7: Ratcap の管理系 UI の配置は?

**Answer**: A. /admin ルートを新設して管理機能を集約する。
/admin/reports(未対応キュー一覧) + /admin/reports/{id}(詳細・resolve/dismiss・
対象アカウントへの suspend/ban 導線)。停止/BAN 操作もアカウント詳細の
Admin セクションから /admin へ集約する
(admin-moderation open question「admin UI 配置」は /admin 集約で決着)。
一般ユーザーの通報作成導線はアカウント詳細画面の「通報する」ボタン +
カテゴリ選択/コメントフォーム。

## Q8: 通報が届いたことにモデレーターが気づく手段は?

**Answer**: A. 未対応件数バッジ。BFF GraphQL に openReportCount 相当の軽いクエリを
追加し、admin/moderator セッションでナビゲーションの Admin メニューに
未対応件数バッジを表示する。Emumet 側は read projection への count を返す
一覧/件数 API で対応。リアルタイムプッシュ通知は行わない。

## Q9: packet の分割と実装順序は?

**Answer**: A. 直列 Emumet 先行。Emumet moderation-account-report を先に
publish・実装し、マージ後に Ratcap admin-moderation(通報 UI + 停止/BAN UI の
/admin 集約 + 件数バッジを含む拡張版)を publish する。
stack の「一度に publish は先頭1件」境界に従う。

検証方針: Emumet は ADR 0006 パターンの単体/統合テスト
(作成→一覧→resolve/dismiss、冪等性、権限拒否)、
Ratcap は BFF リゾルバテスト + mock モード UI 確認。

## Q10: 通報した本人への見え方と重複通報の扱いは?

**Answer**: A. 通報者本人向けの一覧・状態表示は初期スコープ外(送信したら完了)。
重複通報は許可し、同一 target への再通報は別レコードとして蓄積する。
連打が問題になった場合は rate limit で別途対処する。
通報者への状態開示は通知設計とセットの将来論点として残す。

## 帰結

- Emumet `moderation-account-report`: packet-ready。packet draft に進む。
- Ratcap `admin-moderation`: スコープ拡張確定(通報 UI + /admin 集約 + バッジ)。
  Emumet マージ後に publish。
- docs イベントモデル (data-structure.md の AccountReport) との差分:
  updated イベント廃止、closed は resolution 分類追加。docs 同期は host-only
  タスク(document リポジトリ側)として継続。
