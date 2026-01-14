/**
 * Signing Key Generator for UCP Webhook Signing
 * Generates EC or RSA key pairs in JWK format
 */

import * as jose from 'jose';
import { nanoid } from 'nanoid';
import type { JwkKey } from '../types/ucp-profile.js';

export type KeyAlgorithm = 'ES256' | 'RS256';

export interface KeyPairResult {
  publicKey: JwkKey;
  privateKey: string;  // PEM format for merchant storage
}

/**
 * Generate a new signing key pair
 */
export async function generateSigningKeyPair(
  algorithm: KeyAlgorithm = 'ES256'
): Promise<KeyPairResult> {
  const keyId = `ucp-${nanoid(12)}`;

  if (algorithm === 'ES256') {
    return generateECKeyPair(keyId);
  } else {
    return generateRSAKeyPair(keyId);
  }
}

/**
 * Generate EC (P-256) key pair
 */
async function generateECKeyPair(keyId: string): Promise<KeyPairResult> {
  const { publicKey, privateKey } = await jose.generateKeyPair('ES256', {
    extractable: true,
  });

  // Export public key as JWK
  const publicJwk = await jose.exportJWK(publicKey);

  // Export private key as PEM
  const privatePem = await jose.exportPKCS8(privateKey);

  return {
    publicKey: {
      kty: 'EC',
      kid: keyId,
      use: 'sig',
      alg: 'ES256',
      crv: publicJwk.crv as string,
      x: publicJwk.x as string,
      y: publicJwk.y as string,
    },
    privateKey: privatePem,
  };
}

/**
 * Generate RSA (2048-bit) key pair
 */
async function generateRSAKeyPair(keyId: string): Promise<KeyPairResult> {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
    extractable: true,
    modulusLength: 2048,
  });

  // Export public key as JWK
  const publicJwk = await jose.exportJWK(publicKey);

  // Export private key as PEM
  const privatePem = await jose.exportPKCS8(privateKey);

  return {
    publicKey: {
      kty: 'RSA',
      kid: keyId,
      use: 'sig',
      alg: 'RS256',
      n: publicJwk.n as string,
      e: publicJwk.e as string,
    },
    privateKey: privatePem,
  };
}

/**
 * Validate a JWK public key structure
 */
export function validatePublicKey(key: JwkKey): string[] {
  const errors: string[] = [];

  if (!key.kty) {
    errors.push('Missing required field: kty');
  }

  if (!key.kid) {
    errors.push('Missing required field: kid');
  }

  if (key.kty === 'EC') {
    if (!key.crv) errors.push('EC key missing curve (crv)');
    if (!key.x) errors.push('EC key missing x coordinate');
    if (!key.y) errors.push('EC key missing y coordinate');
    if (key.crv && !['P-256', 'P-384', 'P-521'].includes(key.crv)) {
      errors.push(`Unsupported EC curve: ${key.crv}`);
    }
  } else if (key.kty === 'RSA') {
    if (!key.n) errors.push('RSA key missing modulus (n)');
    if (!key.e) errors.push('RSA key missing exponent (e)');
  } else if (key.kty) {
    errors.push(`Unsupported key type: ${key.kty}`);
  }

  return errors;
}

/**
 * Import and validate a public key from JWK
 */
export async function importPublicKey(jwk: JwkKey): Promise<jose.KeyLike | Uint8Array> {
  return jose.importJWK(jwk as jose.JWK, jwk.alg);
}
