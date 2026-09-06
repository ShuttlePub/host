## Goal

drive-foundation (PR #2) のコードレビューで検出された nit 級指摘 8 件を集約して是正する。バリデーション追加・競合安全化・課金解決キャッシュ・レート制限の整理・仕様文書化を 1 実行単位で着地させる。

> 本 issue は手動作成された ShuttlePub/Booskiff#3 (PR #2 レビュー nit 集約, 2026-08-30) を intent-cli packet として正式化したもの。#3 は本 issue への superseded リンクを付けて close される。

## Why This Slice Exists Now

機能阻害なしで後回しにされていた nit 群が、packet 化されていないためワークフローの対象にならず滞留していた。競合時 500 (upsert_rule / ensure_owned_folder) は利用が増えたとき最初に表面化する欠陥系であり、初期利用者フェーズの前に潰す。per-request の課金解決クエリと `/public/{key}` 無制限は将来の負荷リスクで、初動の形を固める。

## Current Observed State

PR #2 レビュー (code-reviewer subagent, 2026-08-30) の指摘:

- ファイル名 (UploadQuery.name) に長さ検証なし (フォルダ名は 255 字検証あり)
- files.rs の `DefaultBodyLimit::max(...)` レイヤは Body 直接抽出ハンドラに実質 no-op (実強制は CountingBody)。誤解を招くので整理したい
- 課金解決が全認証リクエストで DB 2-3 クエリ (global rules + owner rules + plan)。キャッシュなし
- RateLimiters はプロセス内メモリ (複数レプリカ非共有)。rpm 変更で limiter 再生成 → burst リセット
- rules.rs の upsert_rule 2 段 upsert は同時 INSERT で unique violation → 500
- ensure_owned_folder の事前チェックと INSERT が非原子的 (競合で FK 違反 500。404/409 が望ましい)
- /public/{key} は無認証・レート制限なし (帯域計量は初動外だが DoS 面で記録)
- immutable キャッシュ設計により unpublish 後もブラウザ/CDN に残る可能性 (仕様として文書化)

着手前に各指摘が最新コードでも成立することを対象コードで確認すること。

## Accepted Baseline You May Assume

- Rust (Axum) + PostgreSQL (drive-foundation の層構成を踏襲。本 slice はリファクタでなく品質是正)
- 既存の振る舞い契約 (制限値、2 値の公開制御) は変えない
- 設計の根拠はホストリポジトリ `intents/booskiff/` (product / technology / decisions) にある

## Target Repo / Path / Part

Repository: `ShuttlePub/Booskiff`

Target paths: `core/`

Target part: Booskiff core の堅牢化 follow-up (バリデーション・競合安全・キャッシュ・レート制限整理・仕様文書化)

## In Scope

- ファイル名 (UploadQuery.name) にフォルダ名と同等の長さ検証 (255 字上限・空拒否など) を追加。規約はフォルダ名と共有/揃える
- `DefaultBodyLimit::max(...)` の実効性確認と構造整理 (no-op レイヤ撤去 or CountingBody 一本化)。超過時応答の固定
- 課金解決 (global rules + owner rules + plan) への in-memory TTL キャッシュ + 管理者書き込み時の即時無効化
- RateLimiters のレプリカ非共有制約の文書化。rpm 変更時 burst リセットの扱い決定と反映
- upsert_rule の原子化 (単一 INSERT ... ON CONFLICT 等)
- ensure_owned_folder の原子化 (ON CONFLICT DO NOTHING + 再 SELECT 等)
- `/public/{key}` 無認証仕様の文書化 + per-IP の緩いレート制限 (例 300 req/min、規定値を明記) の付与
- immutable キャッシュにより unpublish/削除後も外部キャッシュが残る仕様の文書化 (レスポンスヘッダ方針含む)

## Out Of Scope

- 分散共有キャッシュ・レート制限 (Redis 等)、複数レプリカ展開
- 課金規定値の変更、帯域計量など新規計量軸
- 公開制御の仕様変更、Misskey Drive API 互換
- 上記 8 件以外のリファクタ (気付いた問題は別 packet)
- Web UI (shuttlepub-frontends) 側の変更

## Standalone Child Issue Contract

この PR が配達するもの: Booskiff core において、(1) ファイル名の長さ検証がフォルダ名と同等規約で入り、(2) ボディサイズ制御の実強制経路が一本に整理され超過応答が固定され、(3) 課金解決に TTL キャッシュ + 管理者書き込み即時無効化が導入され通常リクエストで rules/plan クエリが毎回走らず、(4) upsert_rule と ensure_owned_folder が原子化され同時競合で 500 を返さず、(5) RateLimiters のレプリカ非共有制約と burst リセットの扱いが決定・明記され、(6) `/public/{key}` に緩い per-IP レート制限が付き無認証仕様が文書化され、(7) immutable キャッシュの unpublish 非失効仕様が文書化されること。

## Acceptance Criteria

- ファイル名検証: 255 字上限・空拒否。超過時 4xx。同値テストあり
- DefaultBodyLimit 整理後の実強制経路で超過時応答が結合テストで固定される
- 課金解決: キャッシュヒット時に rules/plan クエリが発行されないことと管理者書き込み後の即時反映がテストで確認できる
- upsert_rule 同時 INSERT 競合テスト: unique violation による 500 を返さない (成功上書き or 409)
- ensure_owned_folder 同時生成テスト: FK 違反による 500 を返さない (既存フォルダ再利用 or 404/409)
- `/public/{key}` の per-IP レート制限が規定値で効くテスト
- 3 点 (/public 無認証、immutable キャッシュ非失効、RateLimiters レプリカ非共有) がドキュメント化される

## Verification

1. 既存テスト全通過 (リグレッションなし)
2. 追加テスト (ファイル名同値 / キャッシュ動作・無効化 / 2 件の競合 / レート制限 / ボディ超過応答)
3. `git diff --check`

## Related Links

- 元レビュー: ShuttlePub/Booskiff PR #2 (drive-foundation)
- 手動 issue (本 issue で superseded): ShuttlePub/Booskiff#3
- 設計根拠: ホストリポジトリ `intents/booskiff/decisions/2026-08-29-initial-shaping.md` (D1-D21)

## Knowledge Maintenance

- Intent placement: none (既存 intent 枠組み内の品質是正)
- ADR candidate: none (公開仕様の文書化は Booskiff リポジトリ docs に記録)
- Diagram candidate: none
- Docs update: Booskiff リポジトリ内ドキュメントに 3 点 (/public 無認証、immutable キャッシュ非失効、RateLimiters レプリカ非共有) を記録
- Closeout writeback expected: no (是正時の確認知見は検討のみ)

## Guide Reachability (G645)

implementation-loop ガイド → implementation ロール → ShuttlePub/Booskiff (core/)。本 slice が追加するロール向け surface はなし (既存 API の是正のみ)

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
