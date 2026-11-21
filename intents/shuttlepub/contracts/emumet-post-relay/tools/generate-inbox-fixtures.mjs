// Writes fixtures/inbox/activity-reading.json (hand-authored data, see v1.md "Reading an inbox Activity").
// Usage: node generate-inbox-fixtures.mjs <contract-dir>
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const BOB = 'https://remote.example/users/bob';
const CTX = '"@context":"https://www.w3.org/ns/activitystreams"';
const AS = 'application/activity+json';
const KNOWN_FOLLOW = 'https://remote.example/follows/1';
const KNOWN_BLOCK = 'https://remote.example/blocks/1';
const KNOWN = [KNOWN_FOLLOW, KNOWN_BLOCK];

const cases = [];
const add = (id, title, body, expect, o = {}) => {
  const c = { id, title, content_type: o.ct ?? AS };
  if (o.synthetic) c.body_synthetic = o.synthetic; else c.body = body;
  c.known_relation_ids = o.known ?? KNOWN;
  if (o.markers) c.prior_undo_markers = o.markers;
  c.expect = expect;
  cases.push(c);
};
const fwd = (activity_id, actor = BOB) => ({ outcome: 'forward', activity_id, actor });
const exc = (via) => ({ outcome: 'exclude', via });
const rej = (status, reason) => ({ outcome: 'reject', status, reason });

const act = (type, extra = '', id = 'https://remote.example/a/1') =>
  `{${CTX},${id === null ? '' : `"id":"${id}",`}"type":${type},"actor":"${BOB}"${extra}}`;

// ---- forwarded -----------------------------------------------------------------------------
add('forward-create-to-string', 'Create with `to` as a bare string.', act('"Create"', ',"to":"https://www.w3.org/ns/activitystreams#Public","object":{"type":"Note","content":"hi"}'), fwd('https://remote.example/a/1'));
add('forward-create-actor-object', 'actor as an object with a string id.', `{${CTX},"id":"https://remote.example/a/2","type":"Create","actor":{"id":"${BOB}","type":"Person"},"object":{"type":"Note"}}`, fwd('https://remote.example/a/2'));
add('forward-create-no-id', 'No Activity id: activity_id is null.', act('"Create"', ',"object":{"type":"Note"}', null), fwd(null));
add('forward-id-not-a-string', 'id is a number: not extractable, so null.', `{${CTX},"id":12345,"type":"Like","actor":"${BOB}","object":"https://home.example/n/1"}`, fwd(null));
add('forward-like', 'Like.', act('"Like"', ',"object":"https://home.example/n/1"'), fwd('https://remote.example/a/1'));
add('forward-announce', 'Announce.', act('"Announce"', ',"object":"https://home.example/n/1"'), fwd('https://remote.example/a/1'));
add('forward-delete', 'Delete.', act('"Delete"', ',"object":"https://remote.example/n/9"'), fwd('https://remote.example/a/1'));
add('forward-update', 'Update.', act('"Update"', ',"object":{"id":"https://remote.example/n/9","type":"Note"}'), fwd('https://remote.example/a/1'));
add('forward-extension-type-only', 'A type the receiver has never heard of is still forwarded.', act('"https://example.org/ns#Poll"'), fwd('https://remote.example/a/1'));
add('forward-type-array-with-extension', 'type array: Create plus an extension type.', act('["Create","https://example.org/ns#Foo"]'), fwd('https://remote.example/a/1'));
add('forward-type-array-unknown-only', 'type array of unknown types only.', act('["Foo","Bar"]'), fwd('https://remote.example/a/1'));
add('forward-ldjson-as-profile', 'application/ld+json with the ActivityStreams profile.', act('"Create"'), fwd('https://remote.example/a/1'), { ct: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"' });
add('forward-ldjson-no-profile', 'application/ld+json without a profile parameter.', act('"Create"'), fwd('https://remote.example/a/1'), { ct: 'application/ld+json' });
add('forward-activity-json-charset-uppercase', 'MIME type and charset are case-insensitive.', act('"Create"'), fwd('https://remote.example/a/1'), { ct: 'Application/Activity+JSON; charset=UTF-8' });
add('forward-actor-array-single', 'actor as a one-element array.', `{${CTX},"id":"https://remote.example/a/3","type":"Create","actor":["${BOB}"]}`, fwd('https://remote.example/a/3'));
add('forward-actor-array-same-id-twice', 'actor array whose elements all resolve to one id.', `{${CTX},"id":"https://remote.example/a/4","type":"Create","actor":["${BOB}",{"id":"${BOB}"}]}`, fwd('https://remote.example/a/4'));
add('forward-undo-unknown-url', 'Undo whose object is only a URL the receiver does not know: reference unknown, so forward.', act('"Undo"', ',"object":"https://remote.example/follows/unknown"'), fwd('https://remote.example/a/1'));
add('forward-undo-without-object', 'Undo with no object: not a 422, reference unknown, forward.', act('"Undo"'), fwd('https://remote.example/a/1'));
add('forward-undo-empty-array', 'Undo with an empty object array: reference unknown, forward.', act('"Undo"', ',"object":[]'), fwd('https://remote.example/a/1'));
add('forward-undo-mixed-array', 'Undo with a known Follow and an unknown URL: the whole body is forwarded.', act('"Undo"', `,"object":["${KNOWN_FOLLOW}","https://remote.example/likes/7"]`), fwd('https://remote.example/a/1'));
add('forward-undo-embedded-like', 'Undo of an embedded Like (not a Follow/Block).', act('"Undo"', ',"object":{"id":"https://remote.example/likes/7","type":"Like","object":"https://home.example/n/1"}'), fwd('https://remote.example/a/1'));
add('forward-accept-unknown-url', 'Accept of an unknown URL.', act('"Accept"', ',"object":"https://remote.example/follows/unknown"'), fwd('https://remote.example/a/1'));
add('forward-reject-unknown-url', 'Reject of an unknown URL.', act('"Reject"', ',"object":"https://remote.example/follows/unknown"'), fwd('https://remote.example/a/1'));
add('forward-undo-extension-type-unknown-ref', 'Undo plus an extension type, unknown reference: forward.', act('["Undo","https://example.org/ns#Foo"]', ',"object":"https://remote.example/follows/unknown"'), fwd('https://remote.example/a/1'));
add('forward-undo-prior-undo-marker-is-not-evidence', 'The URL is only recorded as a prior-Undo guard marker (the Follow itself was never seen). A marker is not evidence of a Follow: forward.', act('"Undo"', ',"object":"https://remote.example/follows/early"'), fwd('https://remote.example/a/1'), { markers: ['https://remote.example/follows/early'] });
add('forward-depth-32', 'JSON nesting depth exactly 32 (inclusive limit).', null, fwd(null), { synthetic: { kind: 'nested_depth', depth: 32 } });
add('forward-nodes-100000', 'Exactly 100000 JSON values (inclusive limit).', null, fwd(null), { synthetic: { kind: 'node_count', nodes: 100000 } });
add('forward-body-exactly-1mib', 'Body of exactly 1048576 bytes (inclusive limit).', null, fwd(null), { synthetic: { kind: 'padding', bytes: 1048576 } });
add('forward-type-array-16', 'type array with exactly 16 entries (inclusive limit).', act(`[${Array.from({ length: 16 }, (_, i) => `"https://example.org/ns#T${i}"`).join(',')}]`), fwd('https://remote.example/a/1'));

// ---- excluded (never forwarded) -----------------------------------------------------------------
add('exclude-follow', 'Follow.', act('"Follow"', `,"object":"https://emumet.example/ap/profiles/p1nano"`, KNOWN_FOLLOW), exc('type'));
add('exclude-block', 'Block.', act('"Block"', `,"object":"https://emumet.example/ap/profiles/p1nano"`, KNOWN_BLOCK), exc('type'));
add('exclude-follow-prefixed', '`as:Follow` is recognized as the standard term.', act('"as:Follow"', ',"object":"https://emumet.example/ap/profiles/p1nano"'), exc('type'));
add('exclude-follow-full-iri', 'Full ActivityStreams IRI.', act('"https://www.w3.org/ns/activitystreams#Follow"', ',"object":"https://emumet.example/ap/profiles/p1nano"'), exc('type'));
add('exclude-follow-with-extension-type', 'Follow plus an extension type is still a Follow.', act('["Follow","https://example.org/ns#X"]', ',"object":"https://emumet.example/ap/profiles/p1nano"'), exc('type'));
add('exclude-undo-known-follow-url', 'Undo whose object URL is a known Follow.', act('"Undo"', `,"object":"${KNOWN_FOLLOW}"`), exc('known_reference'));
add('exclude-undo-known-block-url', 'Undo whose object URL is a known Block.', act('"Undo"', `,"object":"${KNOWN_BLOCK}"`), exc('known_reference'));
add('exclude-undo-embedded-follow', 'Undo with an embedded Follow object: the type is certain.', act('"Undo"', `,"object":{"id":"https://remote.example/follows/2","type":"Follow","object":"https://emumet.example/ap/profiles/p1nano"}`), exc('known_reference'));
add('exclude-undo-embedded-block', 'Undo with an embedded Block object.', act('"Undo"', `,"object":{"id":"https://remote.example/blocks/2","type":"Block"}`), exc('known_reference'));
add('exclude-accept-known-follow', 'Accept of a known Follow.', act('"Accept"', `,"object":"${KNOWN_FOLLOW}"`), exc('known_reference'));
add('exclude-reject-known-follow', 'Reject of a known Follow.', act('"Reject"', `,"object":"${KNOWN_FOLLOW}"`), exc('known_reference'));
add('exclude-undo-array-all-known', 'Undo whose object array contains only known Follow/Block references.', act('"Undo"', `,"object":["${KNOWN_FOLLOW}","${KNOWN_BLOCK}"]`), exc('known_reference'));
add('exclude-undo-known-with-extension-type', 'Undo plus an extension type, known reference: the reference decides.', act('["Undo","https://example.org/ns#Foo"]', `,"object":"${KNOWN_FOLLOW}"`), exc('known_reference'));

// ---- rejected (400 / 413, no relation change) --------------------------------------------------------
add('reject-duplicate-key-top-level', 'Duplicate key at the top level.', `{${CTX},"type":"Create","type":"Like","actor":"${BOB}"}`, rej(400, 'duplicate_key'));
add('reject-duplicate-key-nested', 'Duplicate key inside a nested object.', `{${CTX},"type":"Create","actor":"${BOB}","object":{"id":"a","id":"b"}}`, rej(400, 'duplicate_key'));
add('reject-duplicate-key-in-array-element', 'Duplicate key inside an object that is an array element.', `{${CTX},"type":"Create","actor":"${BOB}","tag":[{"name":"x"},{"name":"y","name":"z"}]}`, rej(400, 'duplicate_key'));
add('reject-duplicate-key-after-unescape', 'Keys that are equal only after unescaping (`\\u0074ype` is `type`).', `{${CTX},"type":"Create","\\u0074ype":"Like","actor":"${BOB}"}`, rej(400, 'duplicate_key'));
add('reject-follow-and-block', 'type array holding both Follow and Block: ambiguous relation.', act('["Follow","Block"]'), rej(400, 'ambiguous_relation'));
add('reject-undo-and-follow', 'type array holding two different relation operations.', act('["Undo","Follow"]', ',"object":"https://remote.example/follows/1"'), rej(400, 'ambiguous_relation'));
add('reject-invalid-json', 'Not JSON.', '{"type":"Create",', rej(400, 'invalid_json'));
add('reject-not-an-object', 'Top-level array.', '[{"type":"Create"}]', rej(400, 'not_object'));
add('reject-bom', 'A UTF-8 byte order mark before the JSON text.', `\uFEFF${act('"Create"')}`, rej(400, 'invalid_json'));
add('reject-type-missing', 'No type.', `{${CTX},"id":"https://remote.example/a/1","actor":"${BOB}"}`, rej(400, 'invalid_type'));
add('reject-type-empty-array', 'type is an empty array.', act('[]'), rej(400, 'invalid_type'));
add('reject-type-number', 'type is a number.', act('7'), rej(400, 'invalid_type'));
add('reject-type-array-with-empty-string', 'type array containing an empty string.', act('["Create",""]'), rej(400, 'invalid_type'));
add('reject-type-array-17', 'type array with 17 entries (limit is 16).', act(`[${Array.from({ length: 17 }, (_, i) => `"https://example.org/ns#T${i}"`).join(',')}]`), rej(400, 'invalid_type'));
add('reject-actor-missing', 'No actor.', `{${CTX},"id":"https://remote.example/a/1","type":"Create"}`, rej(400, 'actor_missing_or_ambiguous'));
add('reject-actor-two-ids', 'actor array naming two different ids.', `{${CTX},"type":"Create","actor":["${BOB}","https://remote.example/users/alice"]}`, rej(400, 'actor_missing_or_ambiguous'));
add('reject-actor-number', 'actor is a number.', `{${CTX},"type":"Create","actor":42}`, rej(400, 'actor_missing_or_ambiguous'));
add('reject-depth-33', 'JSON nesting depth 33 (limit is 32).', null, rej(400, 'too_deep'), { synthetic: { kind: 'nested_depth', depth: 33 } });
add('reject-nodes-100001', '100001 JSON values (limit is 100000).', null, rej(400, 'too_many_nodes'), { synthetic: { kind: 'node_count', nodes: 100001 } });
add('reject-body-over-1mib', 'Body of 1048577 bytes.', null, rej(413, 'body_too_large'), { synthetic: { kind: 'padding', bytes: 1048577 } });
add('reject-content-type-json', 'application/json is not accepted on the inbox.', act('"Create"'), rej(400, 'invalid_content_type'), { ct: 'application/json' });
add('reject-content-type-other-profile', 'application/ld+json with a profile other than ActivityStreams.', act('"Create"'), rej(400, 'invalid_content_type'), { ct: 'application/ld+json; profile="https://example.org/other"' });
add('reject-content-type-unknown-parameter', 'application/activity+json with a parameter other than charset=utf-8.', act('"Create"'), rej(400, 'invalid_content_type'), { ct: 'application/activity+json; foo=bar' });

const doc = {
  note: 'Inbox reading fixtures (v1.md "Reading an inbox Activity"). `body` is the exact request body text; `body_synthetic` is built by the harness: padding = {"type":"Create","actor":"https://remote.example/users/bob","pad":"aaa..."} of exactly `bytes` bytes; nested_depth = {"type":"Create","actor":"https://remote.example/users/bob","x":[[...[]...]]} whose JSON container depth is exactly `depth` (the root object is depth 1); node_count = {"type":"Create","actor":"https://remote.example/users/bob","x":[0,0,...]} with exactly `nodes` JSON values in total. known_relation_ids are the ids of Follow/Block activities already stored for the Profile; prior_undo_markers are ids that only exist as early-Undo guard markers.',
  cases,
};
fs.writeFileSync(path.join(root, 'fixtures/inbox/activity-reading.json'), JSON.stringify(doc, null, 2) + '\n');
console.log(cases.length, 'inbox cases');
