# oauth2-consent — requirements

> See [overview.md](overview.md) for goals.

## Functional requirements

- FR1: ユーザーが OAuth2 認可フロー中に `GET /oauth2/consent?consent_challenge=...` へ到達した際、Hydra から `action: "show_consent"` レスポンスが返れば、同意画面を表示する。
- FR2: 同意画面には `client_name` と `requested_scope` の一覧を読みやすい形式で表示する。スコープは日本語プライマリのラベルマップで表示し、未知スコープは生名フォールバックとする (D9)。
- FR3: ユーザーが「許可」を選択すると、`POST /oauth2/consent` へ `{ consent_challenge, accept: true, grant_scope: requested_scope }` を送信する。
- FR4: ユーザーが「拒否」を選択すると、`POST /oauth2/consent` へ `{ consent_challenge, accept: false }` を送信する。`grant_scope` は含めない。
- FR5: `POST /oauth2/consent` から返る 302 レスポンスの `Location` ヘッダーに従ってブラウザをリダイレクトする。
- FR6: `GET /oauth2/consent` がすでに 302 を返す場合（auto-skip 時）は、特に HTML を生成せずそのままリダイレクトを伝搬する。
- FR7: 無効・欠落した `consent_challenge` の場合、エラーメッセージを表示する（ログインページ等への誘導は行わない、D10）。
- FR8: 同意ページは `ratcap_session` を要求しない。Emumet の `GET/POST /oauth2/consent` は consent_challenge ベースの非認証 API であり、同意画面は Hydra ログイン完了後にのみ到達するため (D10)。新たな独自セッション機構も作らない。
- FR9: 同意ページは BFF (`index.ts`) が素の HTML を返す standalone ページとして実装する。Flame SSR ルート・PureScript 側の変更は行わない (D8)。
- FR10: スコープラベルは i18n 構造（言語コード → スコープ → ラベル）で定義し、日本語をプライマリ・英語も出力可能とする。言語はリクエストの `Accept-Language` ヘッダからサーバーサイドで判定する (D9)。

## Non-functional requirements

- NFR1: 本機能は real 認証モード（Kratos + Hydra）でのみ必要。mock モードでは無効でよい。
- NFR2: 同意ページは SEO や SPA ハイドレーションを重視しない。BFF が返す素の HTML + 通常フォーム送信で済ませる (D8)。
- NFR3: 同意画面はシンプルかつアクセシビリティを意識したマークアップにする。
- NFR4: セキュリティ： consent_challenge は URL クエリパラメータとして扱われるが、HTML 内に hidden フィールドまたは安全に保持して送信する。
- NFR5: CSRF 対策：同意/拒否は POST で行う。Hydra が PKCE フローを担保しているため、Ratcap 側は追加の CSRF トークンを必要としないが、セッション Cookie は `SameSite=Lax` / `HttpOnly` など既存設定を維持する。
- NFR6: エラーハンドリング：Emumet または Hydra から予期しないレスポンスが返った場合、ユーザーに分かりやすいエラー画面を表示し、サーバーログに残す。
- NFR7: 既存の `/auth/*` エンドポイントと OAuth2 callback フローに影響を与えない。
- NFR8: テスト：real モードの手動 E2E テストを実施する。BFF 単体テストが可能であれば mock 化して追加する。
