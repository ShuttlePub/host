# di-cleanup-adapter-removal Implementation Packet

## Goal

ADR 0006 Stage 8 (最終 stage)。adapter クレートを解体・削除し、route 層に
facade newtype を導入して生 port / executor へのアクセスをコンパイル時に遮断する。
併せて AppModule/Handler の二重委譲 (~296行) を配線専用1型 + 拡張
`impl_database_delegation!` に集約し、rename 残件 (transfer→dto, Signal 削除) を
先行の純粋 rename commit として処理する。

## Why

Stage 4/7 で Account/Profile/Metadata の書き込みは AggregateRepository 経由に、
投影は tailing projector に移行済みで、adapter の processor は「CommandEnvelope を
組み立てて repository を呼ぶだけ」の薄い調停層に退化している。ADR 決定1 は
「adapter クレートは解体 (kernel / application / driver へ)」、決定7 は
「route には use case メソッドのみを持つ facade newtype を渡し、生の port /
executor へのアクセスをコンパイル時に遮断する」「impl_database_delegation! は
配線専用の1型に集約し、AppModule の手書き委譲を撤去する」と定める。
現状は全34ハンドラが素の `State<AppModule>` を受け、activitypub/mod.rs と
signing.rs が生 executor、oauth2 が生 Ory クライアントに直接到達している。

## 現状ベースライン (host 調査済み・確定値)

- adapter 残存物: processor/account/{command,query}.rs, processor/profile.rs,
  processor/metadata.rs, crypto.rs (計880行)。参照元は application 18 + server 3
  = 21ファイル。driver 参照ゼロ
- 参照数: AccountQueryProcessor 18ファイル / AccountCommandProcessor 2 /
  Profile 系 2-3 / Metadata 系 2-3 / crypto 2
- handler.rs: AppModule { handler: Arc<Handler> }。AppModule 手書き impl 34個
  (L43-338)、うち22個はマクロ生成分と完全重複。マクロ非対象12個
- ルート生アクセス箇所: packet.yaml の technical_baseline 参照 (file:line 列挙済み)
- facade 型は未存在。ルータ拡張 trait (AccountRouter 等) は配線用で狭幅化ではない

## 設計判断 (host 側で確定済み)

1. **rename commit を先行分離する** (決定10 の実施ルール)
   - commit 1 (純粋 rename): `application::transfer` → `application::dto`。
     `kernel::signal::Signal` trait は参照ゼロの孤児なので削除
     (rename ではなく除去、Stage 6 の AuthAccount 系と同じ扱い)
   - `Nanoid` → `PublicId` は **実施しない** (外部 API パス互換。要別途検討)

2. **query processor → `*Query` (kernel)**
   `AccountQuery` / `ProfileQuery` / `MetadataQuery` を kernel に定義
   (read_model/ 配下が自然。決定3 の `*Query` 系統)。メソッド集合は現行
   `*QueryProcessor` と同一とし、`T: DependOn*ReadModel` への blanket impl で提供。
   呼び出し側は `module.account_query_processor()` → `module.account_query()` の
   機械的置換。配置は kernel::read_model::{account,profile,metadata}.rs 内、
   または kernel::query モジュール新設のどちらか (実装者判断、ADR writeback で確定記録)

3. **command processor → use case 直接呼び出し**
   account/create.rs, account/update.rs, account_detail/update.rs,
   account_detail/fields.rs が `AggregateRepository<A>` (DependOn*Repository) を
   直接使う。CommandEnvelope 構築 + persist + 同期 read model 書込みの手順は
   use case 内に移す (現行 processor がやっていることの inline 化)。
   Param 型 (CreateAccountParam 等6つ) は kernel の対応する entity/repository
   モジュールか application 側に移動 (実装者判断)

4. **crypto → kernel**
   `SigningKeyGenerator` / `DependOnSigningKeyGenerator` を
   kernel::interfaces::crypto に移動 (RawKeyGenerator + KeyEncryptor の合成のまま)

5. **facade newtype (決定7 の中核)**
   - 配置: `server/src/api/` (新設)。ルート領域ごとに
     `AccountApi<M>` / `AdminAccountApi<M>` / `MeApi<M>` / `OAuth2Api<M>` /
     `ActivityPubApi<M>` / `SigningApi<M>` 相当の newtype を定義
     (M は必要な DependOn* bound を持つ配線型)
   - **遮断の仕組み**: facade は内部に M を持ち、各メソッド内で
     `self.0.<use_case_method>(...)` を呼ぶ。facade 自身は DependOn* を
     実装しないため、route 側で `facade.database_connection()` 等は
     コンパイルエラーになる。UseCase trait の blanket impl も facade には
     適用されない (DependOn* を満たさないため)
   - facade が公開するもの: 担当ルートの use case メソッド + 正当な補助操作のみ。
     具体的には resolve_auth_account_id (auth.rs:414-440 のロジックを facade
     メソッド化)、find_account_id_by_nanoid (activitypub/mod.rs:56-80 を
     ActivityPubApi / SigningApi のメソッド化)、check_permission 呼び出し、
     public_base_url()、http signature verify (inbox の検証を1メソッドに)、
     hydra/kratos へのアクセス (OAuth2Api の login/consent メソッド)
   - ルートハンドラは `State<AppModule>` から facade を構築するか、
     State 自体を facade にするかは実装者判断 (ただし handler シグネチャが
     facade のみに依存する形にする)

6. **DI 委譲集約 (配線専用1型)**
   - AppModule/Handler の二重構造を1型に統合する (決定10「server の Handler →
     配線専用1型に統合」)。統合後の型名は `AppModule` を推奨 (Handler という
     名前は HTTP handler と衝突するため消す)
   - `impl_database_delegation!` を拡張し、現在手書きの DB 系 trait
     (DependOnAccountEventLog, DependOnProjectionCheckpointStore,
     DependOnAccountProjectionWriter, DependOnBlockRepository,
     DependOnMuteRepository) をマクロ生成対象に追加
   - 非 DB 依存 (PasswordProvider, RawKeyGenerator, KeyEncryptor, Signer,
     SignatureVerifier, PermissionChecker/Writer, HttpSigner,
     HttpSignatureVerifier, PublicBaseUrl) は小さな手書き impl として残る
     (これらは DB 委譲マクロの対象外)
   - 影響: マクロ使用箇所は handler.rs + projection/tests.rs ×3 +
     characterization_tests.rs の TestModule。全て追従させる

7. **テスト内の生アクセス**
   route テスト (block_mute.rs, follow_relations.rs, me.rs) が test 用に
   生 repository / read model を触っているのは許容する (テスト用配線経由)。
   ただしプロダクションの handler コードからの生アクセスは全て除去する

## 実施順序 (推奨)

1. rename commit (transfer→dto, Signal 削除) — 純粋 rename、単独 commit
2. `*Query` trait を kernel に新設 (旧 processor と並存させる parallel change)
3. query 呼び出し側を全置換 → 旧 query processor 削除
4. command 呼び出し側を use case 直接化 → 旧 command processor 削除
5. crypto を kernel に移動
6. adapter 依存を Cargo.toml から除去 → adapter/ 削除
7. facade newtype 導入 + ルート書き換え (領域ごとに分割してよい)
8. DI 委譲集約 (マクロ拡張 + AppModule/Handler 統合)

2-6 と 7-8 は独立に進められるが、1 PR で完結させる
(この stage は参照ゼロ確認が本質なので分割すると中途半端な状態が残る)。

## Acceptance Criteria

packet.yaml の acceptance_criteria を参照 (10項目)。

## Out of Scope

- Nanoid → PublicId rename (外部 API 互換の検討が必要、別ユニット)
- status / media / timeline / notification 系の ES 化 (ADR 0006 の対象外)
- 決定5 (Keto) の変更 (本 Stage で Keto 変更なし)
