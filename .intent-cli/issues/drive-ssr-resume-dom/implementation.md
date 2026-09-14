# drive-ssr-resume-dom Implementation Packet

## Goal

認証済み状態で `/drive` をフルページロード (SSR + resumeMount) した際にクライアント側 DOM が破損する不具合を修正する。現状はフォルダセクション要素の重複 (data-testid=folder-create-submit / folder-list が 2 要素)、セクション間の子ノード混入、イベントハンドラ不活化が発生し、フォルダ作成が不能になる (shuttlepub-frontends#19)。

## Why

hydra-oidc-real-e2e (issue #15 / PR #18) の real E2E で検出。SSR 出力自体は正常と切り分け済みで、原因はクライアント側 (resumeMount または直後の update patch)。real モードの OAuth callback からの /drive 直接遷移という正規の利用経路で確実に発生するため、実運用のブロッカー。E2E は workaround で回避中だが、それは検証範囲の縮小であり恒久的措置にできない。

## Scope

- 破損原因の特定と修正 (候補: resumeMount + LoadDrive → FilesLoaded/FoldersLoaded/BillingLoaded の patch 経路、SSR シリアライズ (FS.serialize/injectState) と resume 時 model round-trip の不一致)
- 回帰テスト: mock E2E に認証済み /drive フルリロードのテストを追加 (修正前に red を確認してから実装 — 現行 mock E2E は /drive フルロードを通らないカバレッジ穴がある)
- real E2E (`apps/booskiff-web/e2e/real/tests/auth.spec.ts`) の #19 workaround 解除 (return_to=/drive 直接 + UI reload による永続化検証に戻す)

## Out of scope

- Drive view の UI/UX 変更 (構造は維持)
- login 導線の OAuth 自動開始 (login-flow-oauth-start / issue #20 の担当)
- FileDetail 以外のルートの resume 挙動の包括監査 (本不具合で見つかった範囲の修正に留める)

## Verification

- 追加した /drive フルリロード回帰テストが修正前 red → 修正後 green
- real E2E: workaround 解除後に `scripts/e2e-real.sh` が green
- mock E2E `scripts/e2e.sh` 16+ 件、`bun test bff/` 97 件、spago test が無回帰
