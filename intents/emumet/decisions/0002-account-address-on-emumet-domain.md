# 0002: アカウントの住所は Emumet ドメインとし、投稿は ShuttlePub へ転送する

- Status: Accepted (2026-07-22 interview で確認)、Amended 2026-08-24 (AP actor を Profile 単位に明確化)
- Deciders: operator

## Context

ShuttlePub 全体の分散思想では、タイムライン構築は本体サービス(ShuttlePub)が担う。
一方 ActivityPub の仕様上、投稿の配送先はアカウントの住所(inbox URL)に紐づく。
両立させる必要があった。

2026-08-24 に operator のプロダクト vision を確認: Emumet は Google Workspace のような
**サービス横断のアカウント管理基盤**であり、1アカウントが複数の Profile
(複数 SNS ペルソナ等)を持てる。AP 責務は最大限 ShuttlePub に寄せる。

## Decision

- アカウントの住所(acct / Actor URL / inbox)は Emumet のドメインで提供する
- Emumet は受信した投稿系アクティビティを、アカウントごとの連携先 ShuttlePub
  サーバーへ転送する(features/post-relay, features/shuttlepub-link)
- ユーザーは利用する本体サービスを変えても住所・フォロワー関係・署名鍵を維持できる
- **(Amended 2026-08-24) AP 上の actor は Account ではなく Profile 単位とする**
  - 1 Profile = 1 actor。acct / Actor URI / 署名鍵 / 連携リンク / フォロー関係は
    すべて Profile スコープで管理する
  - Account は Workspace 的な管理主体(ログイン・課金・Profile の作成削除)であり、
    AP actor ではない
  - 「維持できる」ものの確定範囲(operator 判断 2026-08-24):
    - 住所、フォロワー関係(**followers / following 両方向**)、署名鍵
    - **投稿コンテンツの可用性は保証しない**(発行元 ShuttlePub の寿命に従う。
      export による移行は将来機能)
  - **1 Profile につき active な content link は1つ**とする(複数同時リンクは
    投稿順序・Update/Delete 所有権・inbox 転送の競合を招く)

## Consequences

- Emumet が連合との境界(プロキシ的役割)になる
- ShuttlePub 本体は ActivityPub の配送・署名を意識せずタイムライン構築に集中できる
- 転送プロトコルは未決定(post-relay の open question)
- (Amended 2026-08-24) 現行実装の「account = actor」モデルは、Profile モデルへの
  移行対象となる(即時 rework ではなく、投稿系機能の実装時に合わせて段階移行)
- (Amended 2026-08-24) フォロワー関係を Profile 単位で Emumet が永続保持する必要が
  あるため、フォロワーグラフの権威は Emumet に置く(ap-federation 参照)

## Links

- [features/post-relay](../features/post-relay/overview.md)
- [interview 2026-07-22](../interview/2026-07-22-initial-shaping.md)
