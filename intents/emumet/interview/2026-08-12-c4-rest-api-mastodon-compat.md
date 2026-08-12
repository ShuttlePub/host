# Interview: C4 Emumet REST API (/api/v1) の Mastodon 互換方針 (2026-08-12)

chat-first grill セッションで記録。`intent-cli interview start emumet` は
"No open interview questions found" を返したため、前例
(2026-07-22-initial-shaping.md)と同様に本ファイルへ直接 Q/A を記録する。

対象 clarification: ../clarifications/open.md C4
契機: PR ShuttlePub/Emumet#21 (unfollow-api) レビュー後のオペレーター指摘

## Q1: 将来 Emumet の REST API を直接利用するクライアントの想定範囲は?

**Answer**: B 相当(エコシステム内の任意クライアント)。サービス全体を分散型・
部分ホスト可能にする思想に基づき、Emumet だけ外部ホストのものを利用して
ShuttlePub 本体だけ自己ホストする、あるいは逆に Emumet だけ自己ホストして
外部の ShuttlePub から利用する、という構成を想定する。したがって API の
消費者は Ratcap(BFF)に限らず、エコシステム内の任意クライアント(各ホストの
フロントエンドやネイティブアプリ等)まで広がる。ただし既存 Mastodon
クライアント互換(C)は目指さない。

## Q2: Mastodon API と同一パスの衝突(REST クライアント API 側)をどう扱うか?

**Answer**: そもそもオペレーターの関心は REST クライアント API の互換性では
なかった。気にしていたのは ActivityPub(server-to-server)連合として外部
システムと疎通できるか、であり「Mastodon API」という表現はクライアント API
を指したものではなかった。実体として気にしているのは「Emumet がアカウントを
管理しているため、他の AP サービスが Emumet に対してアカウント情報の取得や
フォローリクエスト等の操作が可能か」という連合相互運用性のみ。

→ 帰結: REST /api/v1 は (a)「Emumet 固有 API」として進める方針で確定。
Mastodon クライアント互換レイヤ(b)・現行ルート改修(c)はいずれも不要。
パス衝突の扱い(A-1 文書宣言 / A-2 改名 / A-3 規約のみ)は低優度の論点として
残るが、オペレーターの懸念はここにはない。

## Q3: 「疎通できる」の保証レベルはどこを目指すか?

**Answer**: A(Mastodon 実サーバーとの E2E を CI で常時検証)はすでに達成済み。

**検証結果(2026-08-12、Emumet リポジトリ実調査)**:
- `server/tests/e2e_ap_mastodon.rs`: S7-S9 シナリオ完全実装済み
  (S7: Mastodon→Emumet フォロー + WebFinger 解決、S8: Emumet→Mastodon
  フォロー、S9: 署名付き Create/Note を Mastodon inbox へ配送し
  パブリックタイムライン出現まで検証)
- `e2e/run-ap-e2e.sh`: 実 Mastodon コンテナ(+ sidekiq)を起動し
  e2e_ap_mastodon を実行。Iceshrimp との相互運用テストも存在
- `.github/workflows/e2e.yml`: main push / PR で常時実行
- commit `89f34b0` (Mastodon E2E 追加) / `6669ac4` (REST API 再編) 由来

→ intent 側ドキュメントがドリフト: `features/ap-federation/overview.md`、
`packets/backlog.md` #5 `mastodon-e2e-completion`、`product/overview.md` の
「未実装」記述が stale。intent-update-ready。

残余ギャップ(軽微): CI の Mastodon E2E は Undo(Follow) の相互運用を
カバーしていない(S7-S9 のみ。Undo 配送は unfollow-api で実装済みだが
実 Mastodon 相手の E2E シナリオ未追加)。
