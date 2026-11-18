---
facets: [vocabulary, invariant]
---

# Mission

## Mission statement

ShuttlePub サービス群全体で共有されるアカウントの唯一の正本(source of truth)を
管理し、ActivityPub 上のアカウントの住所(acct)を Emumet ドメインで提供する。
投稿の署名鍵を預かって ShuttlePub 発の投稿に署名し、受信した Activity を
ホームの ShuttlePub へ転送することで、本体サービス (ShuttlePub) がコミュニティ
(タイムライン・投稿・配送) に集中できるようにする。

※ 2026-11-18 改訂 (shuttlepub domain の
decisions/2026-11-18-service-concept-and-cross-service-p0.md の D27・D30、
2026-11-15 の D12-D14)。旧記述「連合との送受信を代理・中継する」は改めた。
投稿の配送 (fan-out・再送) とリレーは ShuttlePub の責務で、Emumet は署名を行う
(ADR 0003)。例外として Follow / Accept / Block などは Emumet 自身が配送する。
サービス群全体のコンセプトは shuttlepub domain の product/service-concept.md。

## Vision

- ユーザーは 1 つの Emumet アカウントで、任意の連携 ShuttlePub サーバーから
  ActivityPub 連合に参加できる。
- 外部から見たアカウントの住所は常に Emumet ドメインであり、利用する本体サービスを
  変えても住所・フォロワー関係・署名鍵は維持される。
- 1 つの Profile で、ホームの ShuttlePub に加えて複数のコミュニティ (ShuttlePub) に
  参加できる。参加は本人が link と信頼モードを選んで許可する (2026-11-18 D31)。
- Emumet だけを自分で立てて、公式の ShuttlePub に参加できる (2026-11-18 D23)。
- 認証・認可は Ory (Kratos/Hydra) に委譲し、Emumet はアカウント管理・鍵と署名・
  受信の転送に責務を限定する (2026-11-18 改訂。旧記述「連合中継」)。

## Values / principles

- **Event Sourcing + CQRS**: アカウント系の状態変更はすべてイベントとして記録する。
- **責務の分離**: タイムライン構築・投稿永続化・配送・リレーは ShuttlePub 本体、
  認証認可は Ory、アカウント・鍵・署名・受信の転送は Emumet
  (2026-11-18 改訂。旧記述「アカウント・鍵・連合中継は Emumet」)。
- **連合ファースト**: ActivityPub 仕様との整合を優先し、分散思想とのバランスは
  転送モデル(住所=Emumet、本体=ShuttlePub)で解決する。
- **安全性**: SSRF 対策・HTTP Signature 検証など、連合通信の安全性を手抜かない。

## Glossary

- **ShuttlePub(本体)**: タイムラインを構築する SNS 本体サービス。Emumet と連携する。
- **Stellar**: 認可サーバーになる予定だったサービス。凍結し、責務は Emumet と Ory に分散した。
  2026-11-18 に、ShuttlePub との連携 (P1) が通った後、Ory の上に載る薄い認証サービス
  (ログイン・同意のコールバックと DCR の受付が初期候補) として切り出す方向に改めた
  (ADR 0001 の追記、shuttlepub D36-D38)。
- **link**: Profile のアタッチ先 (Profile がどの ShuttlePub サーバーにアタッチしているか)。
  説明の言葉は当面これに揃える (shuttlepub D40)。
- **Ory (Kratos/Hydra)**: 認証(Kratos)と OAuth2/OIDC 認可(Hydra)の外部サービス。
- **連携先 ShuttlePub サービス**: アカウントごとに設定する、自分宛て投稿の転送先。
- **代理署名**: ShuttlePub 発の投稿に対し、Emumet が保持する秘密鍵で HTTP Signature を付与すること。
- **acct / 住所**: `user@emumet-domain` 形式の ActivityPub アカウント識別子。
