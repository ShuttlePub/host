# Product Overview

## これは何か

Emumet は ShuttlePub のアカウント管理サービス。Event Sourcing + CQRS で構築され、
アカウント・プロフィール・フォロー関係・署名鍵を管理し、ActivityPub 連合との
送受信を中継する。名前は EMU (Extravehicular Mobility Unit) + Helmet 由来。

## ユーザー

- **ShuttlePub 利用者**: Ory Kratos で認証し、Emumet 上に ActivityPub アカウントを持つ。
- **ShuttlePub 本体サービス**: Emumet の内部 API(代理署名など)を利用するサービス間クライアント。
- **外部 ShuttlePub ホスト** (2026-08-11 追記): Emumet をリソースサーバーとして利用する
  サードパーティ OAuth2 クライアント。公式以外のホストも登録される見込みのため、
  OAuth2 consent の明示同意画面が必要(Ratcap 側 `oauth2-consent` feature)。
- **インスタンス管理者/モデレーター**: Suspend/Ban 等のモデレーションを行う admin ロール保持者。
- **外部 ActivityPub サーバー**: WebFinger/Actor/Inbox/Outbox を通じて連合するリモート。

## 現状(2026-07 時点の実装インベントリ)

実装済み: Account CRUD + Profile/Metadata、OAuth2 Login/Consent Provider (Hydra 連携)、
WebFinger、Actor、Inbox(Follow/Accept/Undo のみ)、Outbox、Followers/Following、
Follow の送受信配送、HTTP Signature (Cavage 検証 / Cavage+RFC9421 署名)、SSRF 対策、
Suspend/Unsuspend/Ban + Admin/Moderator ロール、ユーザーブロック/ミュート REST API
(block-mute-core 完了: issue #16)、内部代理署名 API、
外向き unfollow REST API(Undo(Follow) 配送) + REST followers/following 一覧
(issue #20 / PR #21)、
Iceshrimp/Mastodon 実機/Mock peer との E2E(CI 常時実行)、
Block アクティビティ連合(送受信 Block/Undo(Block): issue #22 / PR #23)、
画像アップロード + Actor icon/image 反映(issue #43 / PR #44)、
Admin/Moderator ロール割当管理 API(issue #45 / PR #48)。

未実装: 通報(AccountReport)、Create/Note 等の投稿送受信・転送、
連携先 ShuttlePub サービス設定
(2026-08-22 確認、ap-federation / moderation 残スコープ)。

## Non-goals

- タイムライン構築・投稿コンテンツの永続化 → ShuttlePub 本体の責務。
- 認証・認可基盤の自前実装 → Ory (Kratos/Hydra) に委譲。
- Stellar を認可サーバーとして構築すること → 凍結済み(decisions/0001 参照)。
