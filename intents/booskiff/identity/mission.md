---
facets: [vocabulary, invariant]
---

# Mission

## Mission statement

ShuttlePub サービス群 (ShuttlePub / Emumet) でユーザーが投稿・プロフィール等に
利用するファイル (画像中心) を保存・参照する、ドライブストレージサービスを提供する。
Misskey Drive を意識した使い勝手で、単体利用 (スタンドアロン運用) も可能とする。
Emumet に内蔵の S3 永続化は単体運用向けフォールバックとして残しつつ、基本は
本サービスとの連携利用を前提とする。

## Vision

- Emumet Account (ログイン・課金主体) 単位でファイルを管理し、ShuttlePub / Emumet
  からの参照が主用途となる。Misskey Drive 的な UX を提供する。
- 他者とのファイル共有 (Google Drive 的な「輸送」) を提供する。コストがかかる
  ため有料限定機能の候補とする。
- ShuttlePub サービス群で唯一の課金ポイントとして、支払い連携・有料ユーザーの
  制限 (容量・機能) は外部設定で柔軟に変更可能にする。
- 公式・セルフホストの組み合わせを許容する。例: Emumet は公式サーバーで
  アカウント作成し、利用する Booskiff はセルフホストする運用形態。
- 他者が Booskiff だけをセルフホストし、自分の課金ポリシー・制限設定を
  定義できるようにする (課金・セルフホスト設計の参考: Fluxer)。

## Values / principles

- **連携ファースト、単体も第一級**: メインは ShuttlePub / Emumet からの利用だが、
  単体運用 (Emumet 非依存) も正式な利用形態として保つ。Emumet 内蔵 S3 永続化は
  Booskiff 非接続環境のフォールバックとして維持し、切り捨てない。
- **課金の柔軟性**: 支払い連携・容量/機能制限・プラン構成は設定で変更可能にし、
  セルフホスト運用者が独自の課金ポリシーを定義できるようにする。
- **マルチインスタンス柔軟性**: 信頼する Emumet / Ory (issuer) を設定で決め、
  公式 Emumet × セルフホスト Booskiff 等の組み合わせでも動作する認証・参照設計
  にする。
- **所有者は Account、参照は Profile**: ファイルの所有者は Emumet Account
  (人の単位) とし、Profile (AP actor) はアイコン・バナー等としてファイルを
  参照する。課金も Account 単位で管理する。

## Glossary

- **Account (Emumet)**: ログイン・課金・Profile 管理の Workspace 的管理主体。
  AP actor ではない。Booskiff のファイル所有者・課金の単位。
- **Profile (Emumet)**: AP 上の actor。1 Account が複数保持しうる。
  ファイルを参照してアイコン・バナー等に利用する。
- **AuthAccount (Emumet)**: Ory (Kratos/Hydra) 連携の認証解決用エンティティ
  (host_id + client_id)。ユーザーが直接意識する単位ではない。
- **Drive**: Account 単位のファイル保管領域 (Misskey Drive 的)。
- **共有 (輸送)**: Drive 内ファイルを他 Account / 外部へ提供する機能。
  有料限定の候補。
- **フォールバック S3**: Emumet に内蔵の S3 互換ストレージ。Booskiff 非接続
  時の退避先として残す。
