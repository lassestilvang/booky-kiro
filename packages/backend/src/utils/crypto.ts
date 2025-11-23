import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Generate RSA key pair for JWT signing
 * This should be run once during setup and keys should be stored securely
 */
export function generateRSAKeyPair(): {
  privateKey: string;
  publicKey: string;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { privateKey, publicKey };
}

/**
 * Load RSA keys from environment or generate new ones
 */
export function loadOrGenerateKeys(): {
  privateKey: string;
  publicKey: string;
} {
  // Try to load from environment variables first
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    return {
      privateKey: process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      publicKey: process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
    };
  }

  // Try to load from files
  const keysDir = path.join(process.cwd(), 'keys');
  const privateKeyPath = path.join(keysDir, 'jwt-private.pem');
  const publicKeyPath = path.join(keysDir, 'jwt-public.pem');

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    return {
      privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
      publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
    };
  }

  // Generate new keys for development
  console.warn(
    'JWT keys not found. Generating new keys for development. In production, use environment variables or key files.'
  );
  const keys = generateRSAKeyPair();

  // Save keys to files for development
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  fs.writeFileSync(privateKeyPath, keys.privateKey);
  fs.writeFileSync(publicKeyPath, keys.publicKey);

  return keys;
}
