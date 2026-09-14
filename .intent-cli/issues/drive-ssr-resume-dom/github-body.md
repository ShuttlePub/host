## Goal

認証済み `/drive` のフルページロード (SSR + resumeMount) で発生するクライアント側 DOM 破損 (フォルダセクション重複・ハンドラ不活化) を修正する。

## Why This Slice Exists Now

hydra-oidc-real-e2e (#15 / PR #18) の real E2E で確定的に再現した (#19 として起票済)。OAuth callback からの `/drive` 直接遷移という正規経路で発生し、フォルダ作成が不能になる実運用ブロッカー。

## Current Observed State

- フルロード後に `data-testid="folder-create-submit"` と `folder-list` が 2 要素に増殖し、アップロードセクション内にフォルダ名 textbox が混入。フォルダ名を入力しても作成ボタンが disabled のまま
- SSR 出力 HTML は正常 (renderPage 単体実行で各 testid がちょうど 1 つ) → 破損はクライアント側 (resumeMount または直後の update patch)
- FileDetail のフルリロードは正常。Drive view 固有の構造依存が疑われる
- mock E2E は /drive フルロードを通らない (SPA 遷移のみ) ため未検出だった

## Accepted Baseline You May Assume

- real E2E 基盤 (Hydra+Kratos compose) は #15 / PR #18 で main にマージ済み。現在 #19 回避の workaround (return_to=/login SPA 経路 + 永続化の API 検証) 入り
- 調査の手がかり: `Client.purs` の resumeMount、`Client/Update.purs` の LoadDrive patch 経路、`Server.purs` の FS.serialize/injectState と model round-trip

## Target Repo / Path / Part

Repository: `ShuttlePub/shuttlepub-frontends`
Path: `apps/booskiff-web/src` (Client.purs, Client/Update.purs, App/View, Server.purs), `apps/booskiff-web/e2e`
Part: /drive の SSR resume 経路

## Acceptance Criteria

1. 認証済み /drive のフルページロードで DOM が正しく resume され (各 data-testid が 1 つ)、フォルダ作成・ファイル操作のハンドラが動作する
2. 不具合を固定する回帰テスト (mock E2E への /drive フルリロードテスト追加。修正前に red を確認してから実装)
3. real E2E の #19 workaround を解除しても real suite が green
4. mock E2E、real E2E、`bun test bff/`、spago test が無回帰

## In Scope

- 破損原因の特定と修正 (resumeMount/patch 経路、SSR state round-trip)
- mock E2E への /drive フルリロード回帰テスト追加
- real E2E workaround の解除

## Out of Scope

- Drive view の UI/UX 変更
- login 導線の OAuth 自動開始 (issue #20 / login-flow-oauth-start の担当)
- FileDetail 以外のルートの resume 包括監査

## Verification

- 追加した回帰テストが修正前 red → 修正後 green
- real/mock 両 E2E、`bun test bff/`、spago test が green

## Related Links

- 元の検出記録: ShuttlePub/shuttlepub-frontends#19 (本 issue で supersede)
- 検証基盤: ShuttlePub/shuttlepub-frontends#15 / PR #18 (hydra-oidc-real-e2e)

## Base Branch Policy

- ベースブランチ: `main`。ブランチを切って実装し、PR で提出すること
