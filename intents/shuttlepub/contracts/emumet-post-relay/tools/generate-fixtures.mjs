// Generator for the emumet-post-relay v1 fixtures and signature vectors.
//
// Usage: node generate-fixtures.mjs <contract-dir>
//
// Only node:crypto is used (RSA-2048, RSASSA-PKCS1-v1_5 / SHA-256).
// Every run creates NEW key pairs, so running it again replaces every signature, key id
// and public key in fixtures/. Private keys are kept in memory only and are never written:
// the committed vectors are verified with the public keys in fixtures/keys/.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const fx = (...p) => path.join(root, 'fixtures', ...p);
for (const d of ['keys', 'p1', 'p2', 'inbox']) fs.mkdirSync(fx(d), { recursive: true });
for (const d of ['p1', 'p2']) for (const f of fs.readdirSync(fx(d))) fs.unlinkSync(fx(d, f));

const b64 = (b) => Buffer.from(b).toString('base64');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();
const writeJson = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');

// ---- keys ----------------------------------------------------------------------------
const keys = {};
function genKey(name, keyId, owner, note) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  const file = `keys/${name}.pub.pem`;
  fs.writeFileSync(fx(file), pem);
  keys[name] = { privateKey, pem, keyId, owner, file, note };
}

const A = 'https://emumet.example';
const B = 'https://emumet-b.example';
const HOME = 'https://home.example';
const A_ACTOR = `${A}/ap/instance`;
const B_ACTOR = `${B}/ap/instance`;
const PROFILE = `${A}/ap/profiles/p1nano`;
const REMOTE_ACTOR = 'https://remote.example/users/bob';
const TARGET = '/internal/v1/emumet/activities';

genKey('emumet-a-instance-active', `${A_ACTOR}#key-7f3a9c1e`, A_ACTOR, 'Emumet A instance key (active).');
genKey('emumet-a-instance-previous', `${A_ACTOR}#key-2b8d4e60`, A_ACTOR, 'Emumet A previous instance key, still published in the actor document.');
genKey('emumet-b-instance', `${B_ACTOR}#key-b19c0d22`, B_ACTOR, 'Emumet B instance key (a second trusted Emumet).');
genKey('emumet-a-profile', `${PROFILE}#main-key`, PROFILE, 'Profile key of p1nano on Emumet A. MUST NOT be accepted for the outer signature.');
genKey('unrelated', `${A_ACTOR}#key-deadbeef`, A_ACTOR, 'Unrelated key used to forge signatures that claim an Emumet A key id.');
genKey('remote-bob', `${REMOTE_ACTOR}#main-key`, REMOTE_ACTOR, 'Remote actor key used for the ORIGINAL inbox signature stored as evidence.');

function actorDoc(origin, ks) {
  const id = `${origin}/ap/instance`;
  return {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id,
    type: 'Application',
    publicKey: ks.map((k) => ({ id: keys[k].keyId, owner: keys[k].owner, publicKeyPem: keys[k].pem })),
  };
}
const DOC_A = actorDoc(A, ['emumet-a-instance-active', 'emumet-a-instance-previous']);
const DOC_B = actorDoc(B, ['emumet-b-instance']);

// ---- time ----------------------------------------------------------------------------
const NOW = '2026-11-21T09:00:00Z';
const nowMs = Date.parse(NOW);
const httpDate = (ms) => new Date(ms).toUTCString(); // IMF-fixdate
const iso = (ms) => new Date(ms).toISOString();

// ---- original (remote) activity and its evidence ----------------------------------------
const ORIGINAL_BODY =
  '{"@context":"https://www.w3.org/ns/activitystreams","id":"https://remote.example/users/bob/statuses/109/activity",' +
  '"type":"Create","actor":"https://remote.example/users/bob","to":"https://www.w3.org/ns/activitystreams#Public",' +
  '"object":{"id":"https://remote.example/users/bob/statuses/109","type":"Note","content":"こんにちは  世界 \\u00e9"}}';

function originalHeaders(bodyBuf, dateMs, target = '/ap/profiles/p1nano/inbox') {
  const date = httpDate(dateMs);
  const host = 'emumet.example';
  const digest = 'SHA-256=' + b64(sha256(bodyBuf));
  const ss = `(request-target): post ${target}\nhost: ${host}\ndate: ${date}\ndigest: ${digest}`;
  const sig = crypto.sign('sha256', Buffer.from(ss), keys['remote-bob'].privateKey);
  return [
    { name: 'host', value: host },
    { name: 'date', value: date },
    { name: 'digest', value: digest },
    { name: 'content-type', value: 'application/activity+json' },
    {
      name: 'signature',
      value: `keyId="${keys['remote-bob'].keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${b64(sig)}"`,
    },
  ];
}

function baseEnvelope(o = {}) {
  const body = Buffer.from(o.activityBody ?? ORIGINAL_BODY, 'utf8');
  const receivedMs = o.receivedMs ?? nowMs - 19_000;
  const env = {
    version: 1,
    receipt_id: o.receipt_id ?? 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3B',
    received_at: iso(receivedMs),
    sender: { origin: o.senderOrigin ?? A, instance_actor: o.senderActor ?? A_ACTOR },
    recipient: {
      origin: o.recipientOrigin ?? HOME,
      profile_actor: o.profileActor ?? PROFILE,
      link_id: o.link_id ?? 'link_8f2d6c1a9b3e',
      link_generation: o.generation ?? 1,
    },
    activity: {
      id: o.activityId === undefined ? 'https://remote.example/users/bob/statuses/109/activity' : o.activityId,
      actor: REMOTE_ACTOR,
      body_encoding: 'base64',
      raw_body: b64(body),
    },
    verification: {
      result: 'verified',
      scheme: 'cavage',
      key_id: keys['remote-bob'].keyId,
      signer_actor: REMOTE_ACTOR,
      verified_at: iso(receivedMs + 14),
    },
    original_request: {
      method: 'POST',
      request_target: '/ap/profiles/p1nano/inbox',
      signature_headers: o.sigHeaders ?? originalHeaders(body, receivedMs - 1000),
    },
    evidence_complete: o.evidence_complete ?? true,
    omitted_header_names: o.omitted_names ?? [],
    omitted_header_count: o.omitted_count ?? 0,
  };
  if (o.mutate) o.mutate(env);
  return env;
}

// ---- outer request ---------------------------------------------------------------------
function outerRequest(bodyBuf, o = {}) {
  const keyName = o.key ?? 'emumet-a-instance-active';
  const k = keys[keyName];
  const dateMs = o.dateMs ?? nowMs - 2000;
  const date = httpDate(dateMs);
  const host = o.host ?? 'home.example';
  const digest = o.digest ?? 'SHA-256=' + b64(sha256(o.digestOf ?? bodyBuf));
  const listed = o.signedHeaders ?? '(request-target) host date digest';
  const method = o.method ?? 'POST';
  const target = o.target ?? TARGET;
  const signMethod = (o.signMethod ?? method).toLowerCase();
  const signTarget = o.signTarget ?? target;
  const lines = [];
  const vals = { host, date, digest };
  for (const h of listed.split(' ')) {
    lines.push(h === '(request-target)' ? `(request-target): ${signMethod} ${signTarget}` : `${h}: ${vals[h]}`);
  }
  const signingString = lines.join('\n');
  const sig = crypto.sign('sha256', Buffer.from(signingString), (o.signWith ? keys[o.signWith] : k).privateKey);
  const keyId = o.keyId ?? k.keyId;
  const headers = { host, date, digest, 'content-type': o.contentType ?? 'application/json', 'content-length': String(bodyBuf.length) };
  if (!o.noSignature) {
    headers.signature = `keyId="${keyId}",algorithm="rsa-sha256",headers="${listed}",signature="${b64(sig)}"`;
  }
  return { request: { method, target, headers, body: bodyBuf.toString('utf8') }, signingString };
}

const baseReceiver = {
  trusted_emumet_origins: [A, B],
  own_origin: HOME,
  now: NOW,
  instance_actor_documents: { [A]: DOC_A, [B]: DOC_B },
  already_accepted_receipts: [],
};

const P1_PRE = { link_ledger: 'none', note: 'P1 receivers hold no link ledger. link_id and link_generation are the trusted Emumet\'s own claim.' };

function writeCase(dir, c) {
  writeJson(fx(dir, `${c.id}.json`), c);
}

function p1(id, title, expect, envOpts = {}, reqOpts = {}, extra = {}) {
  const env = baseEnvelope(envOpts);
  const bodyBuf = Buffer.from(extra.rawEnvelope ?? JSON.stringify(env), 'utf8');
  const { request } = outerRequest(bodyBuf, reqOpts);
  const receiver = { ...baseReceiver, ...(extra.receiver ?? {}) };
  writeCase('p1', {
    id,
    phase: 'P1',
    title,
    description: extra.description ?? '',
    preconditions: P1_PRE,
    receiver,
    request,
    expect,
  });
  return { env, bodyBuf, request };
}

const ok202 = { result: 'accept', status: 202, reason: 'accepted', sender_class: 'success' };
const rej = (status, reason, cls) => ({
  result: 'reject',
  status,
  reason,
  sender_class: cls ?? (status === 401 ? 'retry' : 'permanent'),
});

// ---- P1 accept cases -------------------------------------------------------------------
const first = p1('p1-ok-minimal', 'A normal envelope from the configured Emumet; no link ledger exists on the receiver.', ok202);

p1('p1-ok-activity-id-null', 'Activity without an id: activity.id is null and nothing is invented.', ok202, {
  activityId: null,
  receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3C',
  activityBody:
    '{"@context":"https://www.w3.org/ns/activitystreams","type":"Like","actor":"https://remote.example/users/bob","object":"https://home.example/notes/1"}',
});

p1(
  'p1-ok-stale-received-at',
  'received_at is about 33 days old (72 h automatic retry + 30 d quarantine, then a manual redelivery). The outer Date is fresh, so the envelope is accepted: age alone is never a reason to reject.',
  ok202,
  { receivedMs: nowMs - 33 * 24 * 3600 * 1000, receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3D' },
  {},
  { description: 'Original request evidence is also ~33 days old; only the outer signature must be fresh.' },
);

p1('p1-ok-unseen-link-claim', 'link_id and link_generation (42) were never seen by the receiver. P1 does not check them against any state.', ok202, {
  generation: 42,
  link_id: 'link_never_seen_before',
  receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3E',
});

p1(
  'p1-ok-evidence-incomplete',
  'Header evidence was reduced (secret header excluded, one header omitted for the 16 KiB budget): evidence_complete=false, omitted names and count are stated. Still accepted.',
  ok202,
  {
    receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3F',
    evidence_complete: false,
    omitted_names: ['authorization', 'x-signed-extra'],
    omitted_count: 3,
    sigHeaders: originalHeaders(Buffer.from(ORIGINAL_BODY), nowMs - 20000).slice(0, 4),
  },
);

p1('p1-ok-second-published-key', 'Signed with the previous instance key that is still published in the same actor document; the key is selected by keyId.', ok202, {
  receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3G',
}, { key: 'emumet-a-instance-previous' });

p1('p1-ok-date-at-tolerance', 'Outer Date is exactly 300 s ahead of the receiver clock: accepted (the tolerance is inclusive).', ok202, {
  receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3H',
}, { dateMs: nowMs + 300_000 });

p1('p1-ok-trusted-second-emumet', 'A second configured Emumet (B) with its own instance actor and key.', ok202, {
  receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3J',
  senderOrigin: B,
  senderActor: B_ACTOR,
  profileActor: `${B}/ap/profiles/p2nano`,
}, { key: 'emumet-b-instance' });

p1(
  'p1-ok-duplicate-receipt',
  'The same (sender.origin, receipt_id) was already accepted. The receiver acknowledges it with 200 and does not store it again.',
  { result: 'accept', status: 200, reason: 'duplicate', sender_class: 'success' },
  {},
  {},
  { receiver: { already_accepted_receipts: [{ sender_origin: A, receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3B' }] } },
);

// ---- P1 reject cases -------------------------------------------------------------------
p1('p1-reject-unknown-emumet', 'keyId and sender.origin point to an Emumet the receiver is not configured for. Nothing is fetched.',
  rej(401, 'untrusted_key_origin'),
  { senderOrigin: 'https://unknown.example', senderActor: 'https://unknown.example/ap/instance' },
  { key: 'unrelated', keyId: 'https://unknown.example/ap/instance#key-0001' });

p1('p1-reject-keyid-other-origin', 'Signed correctly by Emumet B (trusted) but the envelope claims sender.origin = Emumet A.',
  rej(403, 'sender_origin_mismatch'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3K' }, { key: 'emumet-b-instance' });

p1('p1-reject-profile-key', 'The outer signature uses a Profile key (keyId = Profile actor #main-key) instead of the instance key.',
  rej(401, 'unknown_key'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3L' }, { key: 'emumet-a-profile' });

{
  const docMisowned = JSON.parse(JSON.stringify(DOC_A));
  docMisowned.publicKey.push({
    id: `${A_ACTOR}#key-misowned`,
    owner: PROFILE,
    publicKeyPem: keys['emumet-a-profile'].pem,
  });
  p1('p1-reject-key-owner-not-instance-actor', 'The keyId is listed in the instance actor document but its owner is not the instance actor.',
    rej(401, 'key_owner_mismatch'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3M' },
    { key: 'emumet-a-profile', keyId: `${A_ACTOR}#key-misowned` },
    { receiver: { instance_actor_documents: { [A]: docMisowned, [B]: DOC_B } } });
}

p1('p1-reject-wrong-signature', 'Claims the active Emumet A key id but is signed by an unrelated key.',
  rej(401, 'signature_invalid'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3N' },
  { key: 'emumet-a-instance-active', signWith: 'unrelated' });

p1('p1-reject-instance-actor-mismatch', 'sender.instance_actor names the instance actor of another Emumet, not the one that owns the signing key.',
  rej(403, 'instance_actor_mismatch'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3P', senderActor: B_ACTOR });

p1('p1-reject-profile-origin-mismatch', 'recipient.profile_actor belongs to a different origin than sender.origin.',
  rej(403, 'profile_origin_mismatch'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3Q', profileActor: 'https://elsewhere.example/ap/profiles/p9nano' });

p1('p1-reject-recipient-origin-mismatch', 'recipient.origin is not the receiver\'s configured origin.',
  rej(403, 'recipient_origin_mismatch'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3R', recipientOrigin: 'https://other-home.example' });

p1('p1-reject-host-mismatch', 'The signed Host header is not the receiver\'s configured public host.',
  rej(401, 'host_mismatch'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3S' }, { host: 'internal-name.example' });

p1('p1-reject-digest-mismatch', 'The Digest header (and signature over it) describes a different body than the one sent.',
  rej(401, 'digest_mismatch'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3T' }, { digestOf: Buffer.from('some other body') });

p1('p1-reject-date-skew', 'Outer Date is 301 s ahead of the receiver clock (just beyond the inclusive 300 s tolerance).',
  rej(401, 'date_skew'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3U' }, { dateMs: nowMs + 301_000 });

p1('p1-reject-date-skew-past', 'Outer Date is 10 minutes in the past.',
  rej(401, 'date_skew'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3V' }, { dateMs: nowMs - 600_000 });

p1('p1-reject-signature-missing', 'No Signature header.',
  rej(401, 'signature_missing'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3W' }, { noSignature: true });

p1('p1-reject-signature-headers-incomplete', 'The signature does not cover digest (headers="(request-target) host date").',
  rej(401, 'signature_unsupported'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3X' }, { signedHeaders: '(request-target) host date' });

p1('p1-reject-content-type', 'Content-Type is not application/json.',
  rej(415, 'unsupported_media_type'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3Y' }, { contentType: 'application/activity+json' });

p1('p1-reject-unsupported-version', 'version is 2. A future version is never read as v1.',
  rej(400, 'unsupported_version'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2A3Z', mutate: (e) => { e.version = 2; } });

p1('p1-reject-schema-missing-field', 'recipient.link_id is missing.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B0A', mutate: (e) => { delete e.recipient.link_id; } });

p1('p1-reject-schema-unknown-field', 'An unknown top-level field. v1 envelopes contain exactly the listed fields.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B0B', mutate: (e) => { e.extra = true; } });

p1('p1-reject-schema-evidence-inconsistent', 'evidence_complete is true but omitted_header_count is not 0.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B0C', mutate: (e) => { e.omitted_header_count = 1; } });

p1('p1-reject-schema-bad-base64', 'activity.raw_body is not canonical padded standard Base64.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B0D', mutate: (e) => { e.activity.raw_body = 'not base64!'; } });

p1('p1-reject-schema-bad-origin', 'recipient.origin carries a path and the default port.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B0E', mutate: (e) => { e.recipient.origin = 'https://home.example:443/x'; } });

p1('p1-reject-method-get', 'The request is a GET (the signature was made for POST). Only POST is accepted.',
  rej(405, 'method_not_allowed'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1A' }, { method: 'GET', signMethod: 'POST' });

p1('p1-reject-target-other-path', 'Correctly signed for /internal/v1/emumet/other, but the endpoint is /internal/v1/emumet/activities.',
  rej(404, 'not_found'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1B' }, { target: '/internal/v1/emumet/other' });

p1('p1-reject-target-with-query', 'The request target carries a query string (correctly signed for it). The target must be exactly the endpoint path.',
  rej(404, 'not_found'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1C' }, { target: '/internal/v1/emumet/activities?x=1' });

p1('p1-reject-signature-for-other-target', 'Sent to the right target, but the signature covers a different request target. The receiver builds the signing string from the real target.',
  rej(401, 'signature_invalid'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1D' }, { signTarget: '/internal/v1/emumet/other' });

p1('p1-reject-signature-for-other-method', 'Sent as POST, but the signature was made over (request-target): get. The receiver builds the signing string from the real method.',
  rej(401, 'signature_invalid'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1E' }, { signMethod: 'GET' });

p1('p1-reject-schema-month-out-of-range', 'received_at is 2026-99-99T99:99:99Z: the ranges of month, day, hour, minute and second are part of the schema pattern.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1F', mutate: (e) => { e.received_at = '2026-99-99T99:99:99Z'; } });

p1('p1-reject-schema-impossible-received-at', 'received_at is 2026-02-30T10:00:00Z: well-formed, but the day does not exist. Checked outside the schema (v1.md 4.4 item 5).',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1G', mutate: (e) => { e.received_at = '2026-02-30T10:00:00Z'; } });

p1('p1-reject-schema-impossible-verified-at', 'verification.verified_at is 2026-02-29T10:00:00Z: 2026 is not a leap year.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1H', mutate: (e) => { e.verification.verified_at = '2026-02-29T10:00:00Z'; } });

p1('p1-reject-schema-empty-authority', 'activity.actor is "https://#": a URL without an authority.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1J', mutate: (e) => { e.activity.actor = 'https://#'; } });

p1('p1-reject-schema-userinfo-in-url', 'verification.key_id carries userinfo in its authority.',
  rej(400, 'schema_violation'), { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1K', mutate: (e) => { e.verification.key_id = 'https://user@remote.example/users/bob#main-key'; } });

{
  const PUNY_ACTOR = 'https://xn--r8jz45g.example/users/bob';
  const body = '{"@context":"https://www.w3.org/ns/activitystreams","id":"https://xn--r8jz45g.example/users/bob/statuses/1/activity","type":"Create","actor":"' + PUNY_ACTOR + '","object":{"type":"Note","content":"hi"}}';
  p1('p1-ok-punycode-actor', 'The remote actor, Activity id and key owner are on a Punycode (xn--) host: consecutive hyphens inside a DNS label are valid.',
    ok202, { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1M', activityBody: body, activityId: 'https://xn--r8jz45g.example/users/bob/statuses/1/activity', mutate: (e) => {
      e.activity.actor = PUNY_ACTOR;
      e.verification.signer_actor = PUNY_ACTOR;
      e.verification.key_id = PUNY_ACTOR + '#main-key';
    } });
}

p1('p1-ok-leap-day-timestamps', 'received_at and verified_at on 2024-02-29 (a real leap day) are accepted; the age of received_at is irrelevant.',
  ok202, { receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B1L', mutate: (e) => { e.received_at = '2024-02-29T10:00:00Z'; e.verification.verified_at = '2024-02-29T10:00:01.123456789Z'; } });

{
  // Envelope larger than 2 MiB: a synthetic body, rejected on size before any signature work.
  const synth = { kind: 'repeat', unit: 'x', bytes: 2097153 };
  writeCase('p1', {
    id: 'p1-reject-envelope-too-large',
    phase: 'P1',
    title: 'The request body is 2 MiB + 1 byte. It is rejected on size alone, before the signature is examined.',
    description: 'Synthetic: the harness builds a body of `bytes` copies of `unit`. No Digest or Signature header is needed.',
    preconditions: P1_PRE,
    receiver: baseReceiver,
    request: {
      method: 'POST',
      target: TARGET,
      headers: { host: 'home.example', 'content-type': 'application/json', 'content-length': '2097153' },
      body_synthetic: synth,
    },
    expect: rej(413, 'envelope_too_large'),
  });
}

// ---- retransmission pair ----------------------------------------------------------------
{
  const env = baseEnvelope({ receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B0F' });
  const bodyBuf = Buffer.from(JSON.stringify(env), 'utf8');
  const a1 = outerRequest(bodyBuf, { dateMs: nowMs - 2000 }).request;
  const a2 = outerRequest(bodyBuf, { dateMs: nowMs + 3600_000 - 2000 }).request;
  const a3 = outerRequest(bodyBuf, { dateMs: nowMs + 33 * 24 * 3600_000 }).request;
  writeJson(fx('retransmission.json'), {
    id: 'retransmission',
    title: 'The same envelope sent three times: first attempt, an automatic retry one hour later, a manual redelivery about 33 days later.',
    unchanged: [
      'request body bytes (the envelope), therefore the Digest header',
      'receipt_id, received_at, sender, recipient (origin, profile_actor, link_id, link_generation)',
      'activity.*, verification.*, original_request.*, evidence_complete, omitted_header_names, omitted_header_count',
      'request target and destination origin (fixed at acceptance)',
    ],
    changed: ['Date header', 'Signature header (signature value over the new Date)'],
    receiver_at_attempt: [
      { now: NOW, request: a1, expect: ok202 },
      { now: iso(nowMs + 3600_000), request: a2, expect: { result: 'accept', status: 200, reason: 'duplicate', sender_class: 'success' }, already_accepted_receipts: [{ sender_origin: A, receipt_id: 'rcpt_01JD8Q2M7K4N5V6W9X0Y1Z2B0F' }] },
      { now: iso(nowMs + 33 * 24 * 3600_000 + 1000), request: a3, expect: ok202, already_accepted_receipts: [], note: 'receiver lost the first receipt (or never stored it); the envelope is still accepted although received_at is ~33 days old' },
    ],
    receiver: baseReceiver,
    preconditions: P1_PRE,
  });
}

// ---- P2 (informative; link ledger required) ----------------------------------------------
function p2(id, title, ledger, genClaim, expect) {
  const env = baseEnvelope({ generation: genClaim, receipt_id: `rcpt_p2_${id.replace(/[^a-z0-9]/g, '_')}_0001`.slice(0, 60) });
  const bodyBuf = Buffer.from(JSON.stringify(env), 'utf8');
  const { request } = outerRequest(bodyBuf, {});
  writeCase('p2', {
    id,
    phase: 'P2',
    status: 'informative-reserved-for-P2',
    title,
    description: 'NOT part of P1 conformance. Requires the receiver to hold a trusted link ledger (how it is synchronized is a P2 design item). Reason codes here are provisional.',
    preconditions: { link_ledger: ledger },
    receiver: baseReceiver,
    request,
    expect,
  });
}
const LINK = { link_id: 'link_8f2d6c1a9b3e', profile_actor: PROFILE, home_origin: HOME };
p2('p2-ok-matching-active-link', 'Ledger: link active at generation 3; envelope claims generation 3.', { links: [{ ...LINK, state: 'active', generation: 3 }] }, 3, ok202);
p2('p2-reject-stale-generation', 'Ledger: generation 3; envelope claims generation 2.', { links: [{ ...LINK, state: 'active', generation: 3 }] }, 2, rej(409, 'link_generation_stale'));
p2('p2-reject-unlinked', 'Ledger: link is unlinked (generation 4).', { links: [{ ...LINK, state: 'unlinked', generation: 4 }] }, 3, rej(409, 'link_not_active'));
p2('p2-reject-unknown-link', 'Ledger holds no such link.', { links: [] }, 1, rej(404, 'link_unknown'));
p2('p2-reject-link-other-profile', 'Ledger: the link belongs to another Profile.', { links: [{ ...LINK, profile_actor: `${A}/ap/profiles/other`, state: 'active', generation: 1 }] }, 1, rej(409, 'link_profile_mismatch'));

// ---- signature vectors ----------------------------------------------------------------------
{
  const vectors = [];
  const bodies = [
    ['empty-object', Buffer.from('{}', 'utf8')],
    ['non-ascii-with-spaces', Buffer.from('{"msg":"こんにちは  世界","n":1}', 'utf8')],
    ['envelope-sized', Buffer.from(JSON.stringify(baseEnvelope({ receipt_id: 'rcpt_vector_envelope_0001' })), 'utf8')],
  ];
  for (const [name, body] of bodies) {
    const o = outerRequest(body, { dateMs: nowMs - 1000 });
    vectors.push({
      id: `vector-${name}`,
      description: 'Positive vector. Recompute Digest and the signing string, then verify with the public key.',
      key_id: keys['emumet-a-instance-active'].keyId,
      public_key_file: keys['emumet-a-instance-active'].file,
      method: 'POST',
      target: TARGET,
      host: 'home.example',
      date: o.request.headers.date,
      body: body.toString('utf8'),
      body_sha256_base64: b64(sha256(body)),
      digest_header: o.request.headers.digest,
      signed_headers: '(request-target) host date digest',
      signing_string: o.signingString,
      signature_header: o.request.headers.signature,
      expect: 'valid',
    });
  }
  const body = bodies[1][1];
  const o = outerRequest(body, { dateMs: nowMs - 1000 });
  const t = outerRequest(Buffer.from('{"msg":"tampered"}', 'utf8'), { dateMs: nowMs - 1000 });
  vectors.push({
    id: 'vector-tampered-body',
    description: 'Negative vector: signature and Digest header of another body are paired with this body.',
    key_id: keys['emumet-a-instance-active'].keyId,
    public_key_file: keys['emumet-a-instance-active'].file,
    method: 'POST', target: TARGET, host: 'home.example', date: t.request.headers.date,
    body: body.toString('utf8'), body_sha256_base64: b64(sha256(body)),
    digest_header: t.request.headers.digest, signed_headers: '(request-target) host date digest',
    signing_string: t.signingString, signature_header: t.request.headers.signature,
    expect: 'digest_mismatch',
  });
  const w = outerRequest(body, { dateMs: nowMs - 1000, signWith: 'unrelated' });
  vectors.push({
    id: 'vector-wrong-key',
    description: 'Negative vector: signed by a key other than the published one.',
    key_id: keys['emumet-a-instance-active'].keyId,
    public_key_file: keys['emumet-a-instance-active'].file,
    method: 'POST', target: TARGET, host: 'home.example', date: w.request.headers.date,
    body: body.toString('utf8'), body_sha256_base64: b64(sha256(body)),
    digest_header: w.request.headers.digest, signed_headers: '(request-target) host date digest',
    signing_string: w.signingString, signature_header: w.request.headers.signature,
    expect: 'signature_invalid',
  });
  const vecFor = (id, description, oo, expect) => {
    const x = outerRequest(body, { dateMs: nowMs - 1000, ...oo });
    vectors.push({
      id, description,
      key_id: keys['emumet-a-instance-active'].keyId,
      public_key_file: keys['emumet-a-instance-active'].file,
      method: 'POST', target: TARGET, host: 'home.example', date: x.request.headers.date,
      body: body.toString('utf8'), body_sha256_base64: b64(sha256(body)),
      digest_header: x.request.headers.digest, signed_headers: '(request-target) host date digest',
      signing_string: x.signingString, signature_header: x.request.headers.signature,
      expect,
    });
  };
  vecFor('vector-signed-for-other-target', 'Negative vector: signed over (request-target): post /internal/v1/emumet/other while the request goes to the endpoint. The signing string rebuilt from method and target differs.', { signTarget: '/internal/v1/emumet/other' }, 'signing_string_mismatch');
  vecFor('vector-signed-for-other-method', 'Negative vector: signed over (request-target): get while the request is a POST.', { signMethod: 'GET' }, 'signing_string_mismatch');
  void o;
  writeJson(fx('signature-vectors.json'), {
    note: 'Outer-signature vectors. Cavage draft, rsa-sha256 (RSASSA-PKCS1-v1_5, SHA-256), RSA-2048. Signing string lines are joined with LF and have no trailing LF. Receiver clock for these vectors is irrelevant (Date skew is covered by the p1 cases).',
    vectors,
  });
}

// ---- key index, actor documents -----------------------------------------------------------------
writeJson(fx('keys', 'keys.json'), {
  note: 'TEST ONLY. Only public keys are committed; private keys were discarded after signing. Regenerating with tools/generate-fixtures.mjs creates different keys.',
  keys: Object.fromEntries(Object.entries(keys).map(([n, k]) => [n, { key_id: k.keyId, owner: k.owner, public_key_file: k.file, note: k.note }])),
});
writeJson(fx('keys', 'instance-actor-documents.json'), { [A]: DOC_A, [B]: DOC_B });

console.log('generated into', root);
