# 0005: /api/v1 は Emumet 固有 API とし Mastodon クライアント API 互換は Non-goal とする

- Status: Accepted (2026-08-12)
- Deciders: operator(grill セッション: ../interview/2026-08-12-c4-rest-api-mastodon-compat.md)

## Context

- Emumet の `/api/v1/accounts/{account_id}/...` はパスが Mastodon クライアント API と
  一致するがセマンティクスが異なる(パスの id は**ローカルのソースアカウント**で、
  対象はボディの `target`。Mastodon はパスの id が対象アカウントでボディ無し)
- この非互換は follow/block/mute からの継続的な設計規約であり、PR #21
  (unfollow-api) レビューでオペレーターから方針確認が上がった
  (clarifications C4)
- grill の結果、オペレーターの関心は REST クライアント API 互換ではなく
  ActivityPub(server-to-server)連合の相互運用性であることが判明。連合側は
  実 Mastodon サーバーとの E2E(S7-S9)が CI で常時検証済み
- サービス全体は分散型・部分ホスト可能が思想。`/api/v1` の消費者は Ratcap(BFF)に
  限らず、外部 ShuttlePub ホストのフロントエンド等エコシステム内の任意クライアントに
  広がりうる(外部 ShuttlePub ホスト構想: ../product/overview.md)

## Decision

- `/api/v1` は Emumet 固有の API であり、Mastodon クライアント API 互換は Non-goal
- Mastodon クライアント互換レイヤの分離(別パス/別サービス)も、現行ルートの
  Mastodon セマンティクス改修も行わない
- 「Mastodon 互換」という語は ActivityPub 連合(server-to-server)相互運用のみを
  指すものとし、クライアント API を指さない
- ActivityPub 連合の相互運用性は実サーバー E2E(Mastodon / Iceshrimp、CI 常時実行)
  をもって保証する

## 却下案と理由

- **(b) Mastodon 互換レイヤを別パスに分離**
  - 理由: Mastodon クライアント互換を目指す要求が存在しない。保守面だけが増える
- **(c) 現行ルートを Mastodon セマンティクスに改修**
  - 理由: 既存消費者(Ratcap)との非互換が発生し、得るものがない
- **パス接頭辞の改名(例: `/emumet/api/v1`)**
  - 理由: 同名パスによる誤解リスクは残るが、改名の破壊的変更コストに見合わない。
    本 ADR の宣言と API ドキュメントでの明示で低減する。外部クライアントが増えて
    実害が出た段階で再検討する

## Consequences

- 今後 `/api/v1` に追加するルートも Emumet 固有セマンティクスで設計してよい。
  Mastodon API とのパス一致を回避する義務は負わないが、紛らわしさを増やす設計は
  レビューで指摘する
- 外部クライアント向けの API ドキュメント整備時は「Mastodon クライアント API では
  ない」ことを先頭に明記する
- 相互運用の保証責任は連合側(`/ap`、WebFinger/Actor/Inbox/Outbox)の E2E に集約される

## Links

- [interview/2026-08-12-c4-rest-api-mastodon-compat.md](../interview/2026-08-12-c4-rest-api-mastodon-compat.md)
- [clarifications/open.md](../clarifications/open.md) C4(解消済み)
- PR ShuttlePub/Emumet#21(unfollow-api、契機となったレビュー)
- `server/tests/e2e_ap_mastodon.rs` — Mastodon 実機連合 E2E(S7-S9)
