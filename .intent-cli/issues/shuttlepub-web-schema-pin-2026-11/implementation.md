# shuttlepub-web-schema-pin-2026-11 Implementation Packet

## Goal

shuttlepub-web の producer schema pin を ShuttlePub `a00d234aedecb0223ba20dc8d7e9334cf9d39e83`・Emumet `c4d6ea3a4f06e924e73ffa058e5ec6e2409f1e3d` に更新し、Emoji 新情報・Hidden.cause・QuotedPost・target_actor・検索契約へ型・adapter・fixture を互換移行する。

## Why

D09・D04・D08 の画面 unit (ユーザー決定済みの作業順) が同じ契約・生成型の上で作業できるよう、先に pin と互換移行を済ませる準備 unit。

## Scope

- pin 更新 (sync・sync-scenarios・codegen)、REST → GraphQL → PureScript の項目保持、Hidden.cause 専用型、引用先 hidden の廃止、target_actor、searchFor 追従、fixture 再生の更新、既存表示の最小追従と README

## Out of scope

- D09・D04・D08 の画面の見た目と新機能、未取込 fixture の取込、e2e/emumet-revision の更新

## Verification

purs-tidy、openapi:verify、codegen:check、spago build/test、bun test、tsc、既存 E2E・visual、`git diff --check`。

## Knowledge Maintenance (G461, optional)

- Intent placement: 新規ノード不要 (social-experience.md の下、candidates.md に到達範囲を追記)。
- ADR candidate: none.
- Diagram candidate: none.
- Docs update: candidates.md に完全 SHA と後続 unit への申し送り。
- Closeout learning: Hidden.cause の専用型、引用先 hidden の廃止、外部絵文字の反応規則、target_actor の欠落拒否、未取込 fixture の引き継ぎ。write_back_required: true.
- Guide reachability (G645): `guide workflow task implementation-loop` / implementation → ShuttlePub/shuttlepub-frontends (apps/shuttlepub-web)。
