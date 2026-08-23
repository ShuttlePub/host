# oauth2-consent — open questions

> See [../../clarifications/open.md](../../clarifications/open.md) for domain-level open questions.

## Open questions blocking this feature

- なし(2026-08-24 grill で全件解消)。

## Resolved

- ~~Q1: 同意 UI を Ratcap でホストするか、Emumet の既存テンプレートで済ませるか？~~ **(2026-07-28 解決)**
  - 決定: Ratcap でホストする。デザイン統一がしやすく、BFF が既に `/auth/*` で Hydra/Kratos と連携済みのため consent も BFF の守備範囲に入れるのが自然。Hydra consent URL の Ratcap 向け設定変更を伴う (decisions.md D6 参照)。
- ~~Q2: `consent_challenge` はどのように Ratcap へ到達するか？~~ **(2026-08-24 解決 / D2・D6 で確定済み)**
  - 決定: Hydra がユーザーのブラウザを Ratcap `/oauth2/consent?consent_challenge=...` へ直接リダイレクトする (Hydra consent URL の設定変更、D6)。Emumet 経由の中継は不要。Ratcap は challenge をクエリで受け、Emumet の `GET /oauth2/consent` (challenge ベース非認証 API、`ShowConsent { consent_challenge, client_name, requested_scope }` を返却・skip 時は 302) をサーバーサイドで呼ぶ。
- ~~Q3: 同意画面は SSR ページとして生成するか、BFF 内で単純な HTML 文字列を返すか？~~ **(2026-08-24 解決 / D8)**
  - 決定: BFF (`index.ts`) が素の HTML を返す standalone ページ。Flame SSR ルートは採用しない。
- ~~Q4: 「拒否」時の最終的な遷移先はどうするか？~~ **(2026-08-24 解決 / D3 再確認)**
  - 決定: 追加の誘導は行わない。`POST /oauth2/consent` (`accept: false`) の 302 `Location` (`error=access_denied` 付きのクライアント redirect_uri) にそのまま従う。OAuth2 標準の拒否フローであり、エラー表示はクライアント側の責務。
- ~~Q5: 未ログイン時に `/oauth2/consent` へ直接アクセスされた場合、どこへ誘導するか？~~ **(2026-08-24 解決 / D10)**
  - 決定: どこへも誘導しない。同意ページは `ratcap_session` を要求せず、challenge のみで動作する。challenge 欠落・不正時は Hydra 照会が失敗するためエラーページを表示して終了 (ログインページへの誘導はしない)。
- ~~Q6: 同意ページに表示するスコープ名をそのまま表示するか、日本語ラベルマップを用意するか？~~ **(2026-08-24 解決 / D9)**
  - 決定: 日本語プライマリのラベルマップ + i18n 構造 (英語も出力可能)。言語は `Accept-Language` ヘッダからサーバーサイド判定。未知スコープは生名フォールバック。
