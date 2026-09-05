import * as nacl from 'tweetnacl';
import { createHmac, timingSafeEqual } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import {
  AURAFLOW_AUTH_WALLET_HEADER,
  AURAFLOW_AUTH_TIMESTAMP_HEADER,
  AURAFLOW_AUTH_SIGNATURE_HEADER,
  AURAFLOW_SESSION_HEADER,
  AUTH_MESSAGE_PREFIX,
  AUTH_VERSION,
  DEFAULT_MAX_AGE_MS,
  MAX_FUTURE_SKEW_MS,
} from './wallet-auth.types';

function getSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto API is unavailable');
  return subtle;
}

function normalizePath(path: string) {
  try {
    const url = new URL(path, 'http://localhost');
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return `${pathname}${url.search}`;
  } catch {
    let normalized = path;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  }
}

function bytesToHex(value: Uint8Array) {
  return Array.from(value).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await getSubtleCrypto().digest('SHA-256', encoded as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

export async function buildWalletRequestAuthMessage(input: {
  wallet: string;
  method: string;
  path: string;
  timestamp: string;
  body?: string;
}) {
  const bodySha256 = await sha256Hex(input.body ?? '');
  return [
    AUTH_MESSAGE_PREFIX,
    `version:${AUTH_VERSION}`,
    `wallet:${input.wallet}`,
    `method:${input.method.toUpperCase()}`,
    `path:${normalizePath(input.path)}`,
    `timestamp:${input.timestamp}`,
    `bodySha256:${bodySha256}`,
  ].join('\n');
}

export async function verifySignedWalletRequest(input: {
  headers: Record<string, string>;
  expectedWallet: string;
  method: string;
  path: string;
  body?: string;
  maxAgeMs?: number;
}) {
  const wallet = input.headers[AURAFLOW_AUTH_WALLET_HEADER]?.trim() ?? '';
  const timestamp = input.headers[AURAFLOW_AUTH_TIMESTAMP_HEADER]?.trim() ?? '';
  const signature = input.headers[AURAFLOW_AUTH_SIGNATURE_HEADER]?.trim() ?? '';

  if (!wallet || !timestamp || !signature) throw new Error('Missing request authorization headers');
  if (wallet !== input.expectedWallet) throw new Error('Wallet authorization does not match');

  const parsedTimestamp = Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp)) throw new Error('Invalid timestamp');

  const ageMs = Date.now() - parsedTimestamp;
  if (ageMs > (input.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) throw new Error('Request authorization has expired');
  if (ageMs < -MAX_FUTURE_SKEW_MS) throw new Error('Timestamp is too far in the future');

  const message = await buildWalletRequestAuthMessage({ wallet, method: input.method, path: input.path, timestamp, body: input.body });

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
    const publicKeyBytes = Keypair.fromPublicKey(wallet).rawPublicKey();

    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!verified) throw new Error('Invalid signature');
  } catch (err: any) {
    throw new Error('Invalid signature: ' + err.message);
  }

  return { wallet, timestamp };
}

function getSessionSecret() {
  const secret = process.env.AURAFLOW_SESSION_SECRET || process.env.AURAFLOW_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('Missing AURAFLOW_SESSION_SECRET');
  return secret;
}

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signHmac(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function createWalletSessionToken(wallet: string) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const payload = { wallet, exp: expiresAt };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signHmac(encodedPayload);
  return { sessionToken: `${encodedPayload}.${signature}`, expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyWalletSessionToken(sessionToken: string, expectedWallet: string) {
  const [encodedPayload, providedSignature] = sessionToken.split('.');
  if (!encodedPayload || !providedSignature) throw new Error('Invalid session token');

  const expectedSignature = signHmac(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid session signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (payload.wallet !== expectedWallet) throw new Error('Session wallet mismatch');
  if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) throw new Error('Session expired');

  return { wallet: payload.wallet, expiresAt: new Date(payload.exp).toISOString() };
}

export function extractSessionWallet(sessionToken: string): string | null {
  try {
    const [encodedPayload] = sessionToken.split('.');
    if (!encodedPayload) return null;
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.wallet || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload.wallet;
  } catch {
    return null;
  }
}

export function isWalletAuthorizationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('authorization') || message.includes('session') || message.includes('signature') ||
    message.includes('expired') || message.includes('timestamp') || message.includes('missing request authorization') ||
    message.includes('does not match')
  );
}
