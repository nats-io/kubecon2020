import base64url from 'base64url';
import jwtDecode from 'jwt-decode';
import { encode, decode, fromPublic, fromSeed } from 'nkeys.js';

import buffer from 'buffer';
window.Buffer = buffer.Buffer;

const header = {
  typ: 'JWT',
  alg: 'ed25519-nkey',
};

const te = new TextEncoder('utf-8');
const td = new TextDecoder('utf-8');

function encodeSignJwt(seed, payload) {
  const keys = fromSeed(te.encode(seed));

  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));

  const toSign = `${encHeader}.${encPayload}`;

  const sig = keys.sign(te.encode(toSign));
  const encSig = base64url(sig);

  return `${toSign}.${encSig}`;
}

function decodeVerifyJwt(tok) {
  const sps = tok.split('.');
  if (sps.length !== 3) {
    throw new Error(`unexpected jwt chunks, got ${sps.length}, want 3`);
  }

  const h = JSON.parse(base64url.decode(sps[0]));
  if (h.alg !== header.alg) {
    throw new Error(`unexpected alg, got ${h.alg}, want ${header.alg}`);
  }

  const payloadStr = base64url.decode(sps[1]);
  const payload = JSON.parse(payloadStr);

  const pub = fromPublic(payload.iss);
  const sig = base64url.toBuffer(sps[2]);
  const toVerify = `${sps[0]}.${sps[1]}`;

  if (!pub.verify(te.encode(toVerify), sig)) {
    throw new Error(`failed to verify jwt`);
  }

  return payload;
}

function decodeJwt(tok) {
  return jwtDecode(tok);
}

export {
  encodeSignJwt,
  decodeVerifyJwt,
  decodeJwt,
};
