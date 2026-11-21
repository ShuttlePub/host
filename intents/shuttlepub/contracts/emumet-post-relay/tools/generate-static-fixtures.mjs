// Writes fixtures/formats/field-formats.json and fixtures/evidence/header-omission.json.
// Usage: node generate-static-fixtures.mjs <contract-dir>
//
// Both files are data: no keys are involved, so re-running this script is stable. The expected
// results of header-omission.json come from the reference implementation below (v1.md section 4.3);
// the Emumet test re-implements the algorithm independently and compares.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const fx = (...p) => path.join(root, 'fixtures', ...p);
for (const d of ['formats', 'evidence']) fs.mkdirSync(fx(d), { recursive: true });
const writeJson = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
const K = JSON.parse(fs.readFileSync(path.join(root, 'v1.constants.json'), 'utf8')).constants;
const schema = JSON.parse(fs.readFileSync(path.join(root, 'v1.schema.json'), 'utf8'));

// ---- field formats (v1.md section 4.5) ---------------------------------------------------------
const daysIn = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const calendarOk = (ts) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(ts);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(y, mo);
};
const tsPattern = new RegExp(schema.$defs.timestamp.pattern);
const ts = [];
const addTs = (value, schema_valid, calendar_valid, note) => {
  if (tsPattern.test(value) !== schema_valid) throw new Error(`generator: schema_valid wrong for ${value}`);
  if (schema_valid && calendarOk(value) !== calendar_valid) throw new Error(`generator: calendar_valid wrong for ${value}`);
  ts.push({ value, schema_valid, calendar_valid, valid: schema_valid && calendar_valid, ...(note ? { note } : {}) });
};
for (const v of ['2026-11-21T09:00:00Z', '2026-11-21T09:00:00.1Z', '2026-11-21T09:00:00.123456789Z', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z']) addTs(v, true, true);
addTs('2024-02-29T00:00:00Z', true, true, 'leap day');
addTs('2000-02-29T00:00:00Z', true, true, 'leap day of a century divisible by 400');
for (const v of ['2026-02-30T10:00:00Z', '2026-02-29T10:00:00Z', '2026-04-31T10:00:00Z', '2026-06-31T10:00:00Z', '2026-09-31T10:00:00Z', '2026-11-31T10:00:00Z']) addTs(v, true, false, 'passes the pattern; the day does not exist in that month and year (checked outside the schema)');
addTs('1900-02-29T00:00:00Z', true, false, '1900 is not a leap year');
addTs('2100-02-29T00:00:00Z', true, false, '2100 is not a leap year');
for (const v of [
  '2026-99-99T99:99:99Z', '2026-13-01T00:00:00Z', '2026-00-10T00:00:00Z', '2026-11-00T00:00:00Z', '2026-11-32T00:00:00Z',
  '2026-11-21T24:00:00Z', '2026-11-21T09:60:00Z', '2026-11-21T09:00:60Z', '2026-11-21T09:00:00+00:00', '2026-11-21t09:00:00z',
  '2026-11-21T09:00:00', '2026-11-21 09:00:00Z', '2026-11-21T09:00:00.Z', '2026-11-21T09:00:00.1234567890Z', '26-11-21T09:00:00Z', '',
]) addTs(v, false, false, 'rejected by the schema pattern');

const urls = [];
const urlPatterns = {
  remote_url: new RegExp(schema.$defs.remote_url.pattern),
  emumet_url: new RegExp(schema.$defs.emumet_url.pattern),
  origin: new RegExp(schema.$defs.origin.pattern),
  instance_actor: new RegExp(schema.properties.sender.properties.instance_actor.pattern),
};
const addUrl = (def, value, valid, note) => {
  let ok = urlPatterns[def].test(value);
  if (def === 'origin' && /:443$/.test(value)) ok = false;
  if (value.length > K.URL_MAX) ok = false;
  if (ok !== valid) throw new Error(`generator: ${def} ${value.slice(0, 60)} expected ${valid}`);
  urls.push({ def, value, valid, ...(note ? { note } : {}) });
};
const R = 'https://remote.example';
for (const v of [`${R}/users/bob`, 'http://remote.example/u', R, `${R}:8443/u`, 'https://Remote.Example/u', `${R}#frag`, `${R}?x=1`, `${R}:65535/u`, 'https://a.b-c.example/u', `${R}/users/bob#main-key`]) addUrl('remote_url', v, true);
for (const v of ['https://xn--r8jz45g.example/users/bob', 'http://xn--n3h.example', 'https://a--b.example/u', 'https://xn--r8jz45g.xn--zckzah/u']) addUrl('remote_url', v, true, 'Punycode / consecutive hyphens inside a label');
addUrl('remote_url', `${R}/` + 'a'.repeat(K.URL_MAX - R.length - 1), true, `exactly URL_MAX (${K.URL_MAX}) characters`);
addUrl('remote_url', `${R}/` + 'a'.repeat(K.URL_MAX - R.length), false, `URL_MAX + 1 characters`);
for (const [v, n] of [
  ['https://#', 'empty authority'], ['https://?x', 'empty authority'], ['https://', 'empty authority'], ['https:///path', 'empty authority'],
  ['https://user@remote.example/u', 'userinfo'], ['https://user:pw@remote.example/', 'userinfo'], ['https://[::1]/u', 'IPv6 literal'],
  [`${R}:0/u`, 'port 0'], [`${R}:65536/u`, 'port above 65535'], [`${R}:08080/u`, 'leading zero in the port'], [`${R}:/u`, 'empty port'],
  [`${R}:443x/u`, 'port with a letter'], ['https://remote..example/u', 'empty label'], ['https://-remote.example/u', 'leading hyphen'],
  ['https://remote.example./u', 'trailing dot'], ['https://a-.example/u', 'label ends with a hyphen'], ['https://a.-b.example/u', 'label starts with a hyphen'], ['https://a--.example/u', 'label ends with hyphens'], ['ftp://remote.example/u', 'scheme'], [`${R}/with space`, 'space'], [`${R}/\u00fc`, 'non-ASCII path'],
  ['https://r\u00e9mote.example/u', 'non-ASCII host'], ['//remote.example/u', 'no scheme'], ['remote.example/u', 'no scheme'],
]) addUrl('remote_url', v, false, n);
for (const v of ['https://emumet.example/ap/profiles/p1nano', 'https://emumet.example:8443/ap/x', 'https://xn--emumet-9d0b.example/ap/profiles/p1nano']) addUrl('emumet_url', v, true);
for (const [v, n] of [['https://emumet.example', 'no path'], ['http://emumet.example/x', 'http'], ['https://Emumet.example/x', 'uppercase host'], ['https://#/x', 'empty authority'], ['https://user@emumet.example/x', 'userinfo'], ['https://emumet.example:99999/x', 'port']]) addUrl('emumet_url', v, false, n);
for (const v of ['https://home.example', 'https://home.example:8443', 'https://xn--home-7qa.example']) addUrl('origin', v, true);
for (const [v, n] of [['https://home.example:443', 'default port'], ['https://home.example/', 'path'], ['https://home.example:0', 'port 0'], ['https://HOME.example', 'uppercase'], ['http://home.example', 'http'], ['https://home.example:99999', 'port']]) addUrl('origin', v, false, n);
for (const v of ['https://emumet.example/ap/instance', 'https://emumet.example:8443/ap/instance', 'https://xn--emumet-9d0b.example/ap/instance']) addUrl('instance_actor', v, true);
for (const [v, n] of [['https://emumet.example/ap/other', 'other path'], ['https://emumet.example/ap/instance/', 'trailing slash'], ['http://emumet.example/ap/instance', 'http']]) addUrl('instance_actor', v, false, n);

writeJson(fx('formats', 'field-formats.json'), {
  note: 'v1.md section 4.5. `timestamps`: `schema_valid` is the result of the schema pattern, `calendar_valid` the day-exists check outside the schema; `valid` needs both. `urls`: `def` names the schema definition (remote_url = activity.actor, emumet_url = recipient.profile_actor, origin = recipient.origin, instance_actor = sender.instance_actor); `valid` is the result of the schema (a value longer than URL_MAX is invalid).',
  field_for_def: { remote_url: 'activity.actor', emumet_url: 'recipient.profile_actor', origin: 'recipient.origin', instance_actor: 'sender.instance_actor' },
  timestamps: ts,
  urls,
});

// ---- header omission (v1.md section 4.3) --------------------------------------------------------
const SECRET_NAMES = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie']);
const isSecret = (n) => SECRET_NAMES.has(n) || ['token', 'secret', 'api-key', 'apikey', 'password'].some((w) => n.includes(w));
const printable = (v) => /^[\x20-\x7e]*$/.test(v);

// RFC 8941 sf-string starting at v[i] === '"': returns [unescaped value, index after the closing quote] or null.
function readSfString(v, i) {
  let out = '';
  i++;
  while (i < v.length) {
    const ch = v[i];
    if (ch === '\\') {
      if (i + 1 >= v.length) return null;
      out += v[i + 1];
      i += 2;
    } else if (ch === '"') {
      return [out, i + 1];
    } else {
      out += ch;
      i++;
    }
  }
  return null;
}

function coveredNames(fields) {
  const names = [];
  for (const f of fields.filter((x) => x.name === 'signature')) {
    const m = /headers="([^"]*)"/.exec(f.value);
    if (m) names.push(...m[1].split(/\s+/).filter(Boolean).map((x) => x.toLowerCase()));
  }
  for (const f of fields.filter((x) => x.name === 'signature-input')) {
    const v = f.value;
    let i = 0;
    while (i < v.length) {
      if (v[i] === '"') { const r = readSfString(v, i); i = r ? r[1] : v.length; continue; }
      if (v[i] !== '(') { i++; continue; }
      i++;
      for (;;) {
        while (i < v.length && v[i] === ' ') i++;
        if (i >= v.length || v[i] === ')') { i++; break; }
        if (v[i] !== '"') { i++; continue; }
        const r = readSfString(v, i);
        if (!r) { i = v.length; break; }
        names.push(r[0].toLowerCase());
        i = r[1];
        while (i < v.length && v[i] !== ' ' && v[i] !== ')') {
          if (v[i] === '"') { const q = readSfString(v, i); i = q ? q[1] : v.length; } else i++;
        }
      }
    }
  }
  return names.filter((n) => !n.startsWith('(') && !n.startsWith('@'));
}

function buildEvidence(original) {
  const fields = [];
  original.forEach((h) => { for (let k = 0; k < (h.times ?? 1); k++) fields.push({ name: h.name.toLowerCase(), value: h.value }); });
  const order = [];
  const seen = new Set();
  const push = (idx) => { if (!seen.has(idx)) { seen.add(idx); order.push(idx); } };
  fields.forEach((f, i) => { if (f.name === 'signature' || f.name === 'signature-input') push(i); });
  for (const n of coveredNames(fields)) fields.forEach((f, i) => { if (f.name === n) push(i); });
  for (const n of ['digest', 'content-digest', 'date', 'host', 'content-type', 'content-length']) fields.forEach((f, i) => { if (f.name === n) push(i); });
  const kept = [];
  const names = [];
  let used = 0;
  let count = 0;
  const omit = (f) => {
    count = Math.min(count + 1, K.OMITTED_COUNT_MAX);
    if (!names.includes(f.name) && names.length < K.OMITTED_NAMES_MAX && f.name.length <= K.EVIDENCE_HEADER_NAME_MAX && used + f.name.length <= K.EVIDENCE_BUDGET_BYTES) {
      names.push(f.name);
      used += f.name.length;
    }
  };
  for (const i of order) {
    const f = fields[i];
    const cost = f.name.length + f.value.length;
    if (isSecret(f.name) || f.name.length > K.EVIDENCE_HEADER_NAME_MAX || f.value.length > K.EVIDENCE_HEADER_VALUE_MAX || !printable(f.value) || kept.length >= K.EVIDENCE_MAX_HEADERS || used + cost > K.EVIDENCE_BUDGET_BYTES) {
      omit(f);
    } else {
      kept.push({ name: f.name, value: f.value });
      used += cost;
    }
  }
  return { signature_headers: kept, omitted_header_names: names, omitted_header_count: count, evidence_complete: count === 0 };
}

const ev = [];
const addEv = (id, title, original, check) => {
  const expect = buildEvidence(original);
  if (check) check(expect);
  ev.push({ id, title, original_headers: original, expect });
};
const sigV = (headers, extra = '') => `keyId="https://remote.example/users/bob#main-key",algorithm="rsa-sha256",headers="${headers}",signature="AAAA${extra}"`;
const base = [
  { name: 'Host', value: 'emumet.example' },
  { name: 'Date', value: 'Sat, 21 Nov 2026 08:59:40 GMT' },
  { name: 'Digest', value: 'SHA-256=abc=' },
  { name: 'Content-Type', value: 'application/activity+json' },
  { name: 'User-Agent', value: 'remote/1.0' },
  { name: 'Accept', value: '*/*' },
  { name: 'Signature', value: sigV('(request-target) host date digest') },
];
const names = (e) => e.signature_headers.map((h) => h.name).join(',');
addEv('simple-complete', 'A usual Cavage request. Order: signature, then the covered names in the order of the headers parameter, then the remaining fixed names. user-agent and accept are not candidates.', base, (e) => {
  if (names(e) !== 'signature,host,date,digest,content-type' || !e.evidence_complete) throw new Error('simple-complete');
});
addEv('names-are-lowercased', 'Names are stored in lowercase; values are kept as received.', base.map((h) => ({ ...h, name: h.name.toUpperCase() })), (e) => {
  if (!e.signature_headers.every((h) => h.name === h.name.toLowerCase())) throw new Error('lowercase');
});
addEv('candidate-only-once', 'content-type and date are covered by the signature and also in the fixed list: each field appears once, at its first position.', [
  ...base.slice(0, 4), { name: 'Signature', value: sigV('(request-target) content-type date host digest') },
], (e) => { if (names(e) !== 'signature,content-type,date,host,digest') throw new Error('once ' + names(e)); });
addEv('repeated-header-kept-in-original-order', 'Two date fields: both are kept, in the original order.', [
  { name: 'Date', value: 'Sat, 21 Nov 2026 08:59:40 GMT' }, { name: 'Host', value: 'emumet.example' }, { name: 'Date', value: 'Sat, 21 Nov 2026 08:59:41 GMT' },
  { name: 'Signature', value: sigV('(request-target) host date') },
], (e) => { if (names(e) !== 'signature,host,date,date') throw new Error('repeat ' + names(e)); });
addEv('secret-covered-header-is-omitted', 'The signature covers authorization and x-api-key: both are omitted (named, counted). A cookie that nothing refers to is not a candidate and is not counted.', [
  { name: 'Host', value: 'emumet.example' }, { name: 'Authorization', value: 'Bearer secret' }, { name: 'X-Api-Key', value: 'k' }, { name: 'Cookie', value: 'a=b' },
  { name: 'Signature', value: sigV('(request-target) host authorization x-api-key') },
], (e) => { if (e.omitted_header_names.join() !== 'authorization,x-api-key' || e.omitted_header_count !== 2 || e.evidence_complete) throw new Error('secret'); });
addEv('rfc9421-components', 'Signature-Input components (covered-component parameters are ignored, pseudo-components starting with @ are skipped). Group 1 keeps signature fields in the original order.', [
  { name: 'Signature', value: 'sig1=:AAAA:' },
  { name: 'Signature-Input', value: 'sig1=("@method" "@target-uri" "content-digest";sf "x-extra";tag="a b" "date");created=1700000000;keyid="k"' },
  { name: 'Content-Digest', value: 'sha-256=:abc=:' }, { name: 'Date', value: 'Sat, 21 Nov 2026 08:59:40 GMT' }, { name: 'X-Extra', value: 'v' },
  { name: 'Host', value: 'emumet.example' }, { name: 'Content-Length', value: '42' },
], (e) => { if (names(e) !== 'signature,signature-input,content-digest,x-extra,date,host,content-length') throw new Error('9421 ' + names(e)); });
addEv('rfc9421-escaped-quote-in-parameter', 'A component parameter value holds an escaped quote and a space. The escaped quote does not end the string, so the next covered component, cookie, is found: it is secret-bearing, so it is omitted and counted.', [
  { name: 'Signature', value: 'sig1=:AAAA:' },
  { name: 'Signature-Input', value: 'sig1=("@query-param";name="a\\" b" "cookie" "host");created=1700000000' },
  { name: 'Cookie', value: 'session=1' }, { name: 'Host', value: 'emumet.example' },
], (e) => { if (names(e) !== 'signature,signature-input,host' || e.omitted_header_names.join() !== 'cookie' || e.omitted_header_count !== 1 || e.evidence_complete) throw new Error('escaped param ' + JSON.stringify(e)); });
addEv('rfc9421-escaped-backslash-and-parens-in-parameter', 'A parameter value with an escaped backslash and parentheses does not confuse the parser: the covered x-extra is kept and nothing is omitted.', [
  { name: 'Signature', value: 'sig1=:AAAA:' },
  { name: 'Signature-Input', value: 'sig1=("@method";tag="x\\\\(y)" "x-extra");keyid="k(1)"' },
  { name: 'X-Extra', value: 'v' },
], (e) => { if (names(e) !== 'signature,signature-input,x-extra' || e.omitted_header_count !== 0) throw new Error('escaped backslash ' + JSON.stringify(e)); });
addEv('pseudo-components-are-skipped', '(request-target), (created) and @method are not header fields: not kept, not omitted.', [
  { name: 'Signature', value: sigV('(request-target) (created) @method host') }, { name: 'Host', value: 'emumet.example' },
], (e) => { if (names(e) !== 'signature,host' || e.omitted_header_count !== 0) throw new Error('pseudo'); });

// budget cases
const sigBase = sigV('(request-target) x-pad date');
const sigCost = 'signature'.length + sigBase.length;
const padLen = (target) => target - sigCost - 'x-pad'.length;
const budget = K.EVIDENCE_BUDGET_BYTES;
addEv('budget-exactly-full', 'The kept headers use exactly EVIDENCE_BUDGET_BYTES. Nothing is omitted and the evidence is complete.', [
  { name: 'Signature', value: sigBase }, { name: 'X-Pad', value: 'p'.repeat(padLen(budget)) },
], (e) => { if (!e.evidence_complete || e.signature_headers.length !== 2) throw new Error('exactly full'); });
addEv('budget-one-over-omits-the-big-header', 'One byte more and x-pad is omitted whole (never truncated); its name still fits and is listed.', [
  { name: 'Signature', value: sigBase }, { name: 'X-Pad', value: 'p'.repeat(padLen(budget) + 1) },
], (e) => { if (e.omitted_header_names.join() !== 'x-pad' || e.omitted_header_count !== 1) throw new Error('one over'); });
addEv('budget-full-name-not-listed', 'After x-pad the budget is full. date and content-type no longer fit and are omitted; there is no room left to list their names, so only the count reflects them.', [
  { name: 'Signature', value: sigBase }, { name: 'X-Pad', value: 'p'.repeat(padLen(budget)) },
  { name: 'Date', value: 'Sat, 21 Nov 2026 08:59:40 GMT' }, { name: 'Content-Type', value: 'application/activity+json' },
], (e) => { if (e.omitted_header_names.length !== 0 || e.omitted_header_count !== 2 || e.evidence_complete) throw new Error('full name ' + JSON.stringify(e.omitted_header_names)); });
addEv('examination-continues-after-an-omission', 'x-big does not fit and is omitted; the later, smaller digest and content-type are still kept.', [
  { name: 'Host', value: 'emumet.example' }, { name: 'X-Big', value: 'b'.repeat(budget - 100) }, { name: 'Digest', value: 'SHA-256=abc=' }, { name: 'Content-Type', value: 'application/activity+json' },
  { name: 'Signature', value: sigV('(request-target) host x-big digest') },
], (e) => { if (names(e) !== 'signature,host,digest,content-type' || e.omitted_header_names.join() !== 'x-big') throw new Error('continue ' + names(e)); });
addEv('value-not-ascii-or-too-long', 'A value with a non-ASCII character, and a value longer than EVIDENCE_HEADER_VALUE_MAX, are omitted, not altered.', [
  { name: 'X-Note', value: 'caf\u00e9' }, { name: 'X-Long', value: 'l'.repeat(K.EVIDENCE_HEADER_VALUE_MAX + 1) }, { name: 'Host', value: 'emumet.example' },
  { name: 'Signature', value: sigV('(request-target) host x-note x-long') },
], (e) => { if (names(e) !== 'signature,host' || e.omitted_header_names.join() !== 'x-note,x-long' || e.omitted_header_count !== 2) throw new Error('ascii'); });
const longName = 'x'.repeat(K.EVIDENCE_HEADER_NAME_MAX + 1);
addEv('name-too-long-is-counted-not-listed', 'A header name longer than EVIDENCE_HEADER_NAME_MAX cannot be kept and cannot be listed (the schema bounds the listed names): it is only counted.', [
  { name: longName, value: 'v' }, { name: 'Host', value: 'emumet.example' },
  { name: 'Signature', value: sigV(`(request-target) host ${longName}`) },
], (e) => { if (e.omitted_header_names.length !== 0 || e.omitted_header_count !== 1) throw new Error('long name'); });
addEv('omitted-names-limit', 'More distinct omitted names than OMITTED_NAMES_MAX: the first OMITTED_NAMES_MAX are listed, the count covers all of them.',
  [
    ...Array.from({ length: K.OMITTED_NAMES_MAX + 1 }, (_, i) => ({ name: `X-Token-${String(i + 1).padStart(2, '0')}`, value: 't' })),
    { name: 'Signature', value: sigV('(request-target) ' + Array.from({ length: K.OMITTED_NAMES_MAX + 1 }, (_, i) => `x-token-${String(i + 1).padStart(2, '0')}`).join(' ')) },
  ], (e) => { if (e.omitted_header_names.length !== K.OMITTED_NAMES_MAX || e.omitted_header_count !== K.OMITTED_NAMES_MAX + 1) throw new Error('names limit'); });
addEv('too-many-headers', `More than EVIDENCE_MAX_HEADERS (${K.EVIDENCE_MAX_HEADERS}) entries: the first ${K.EVIDENCE_MAX_HEADERS} are kept (signature first), the rest are omitted.`, [
  { name: 'Signature', value: sigV('(request-target) date') }, { name: 'Date', value: 'x', times: K.EVIDENCE_MAX_HEADERS + 6 },
], (e) => { if (e.signature_headers.length !== K.EVIDENCE_MAX_HEADERS || e.omitted_header_count !== 7 || e.omitted_header_names.join() !== 'date') throw new Error('64 ' + e.omitted_header_count); });
addEv('count-saturates', `The omitted count stops at OMITTED_COUNT_MAX (${K.OMITTED_COUNT_MAX}).`, [
  { name: 'Authorization', value: 'a', times: K.OMITTED_COUNT_MAX + 76 }, { name: 'Signature', value: sigV('(request-target) authorization') },
], (e) => { if (e.omitted_header_count !== K.OMITTED_COUNT_MAX || e.omitted_header_names.join() !== 'authorization') throw new Error('saturate'); });

writeJson(fx('evidence', 'header-omission.json'), {
  note: 'v1.md section 4.3. `original_headers` are the header fields of the original request in the order received (an entry with `times` stands for that many identical fields in a row). `expect` is the envelope evidence: `signature_headers`, `omitted_header_names`, `omitted_header_count`, `evidence_complete`.',
  cases: ev,
});
console.log(ts.length, 'timestamp cases,', urls.length, 'url cases,', ev.length, 'evidence cases');
