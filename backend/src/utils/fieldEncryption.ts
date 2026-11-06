import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Bank account numbers and identity documents are stored encrypted, so a leaked database or backup
// does not expose them. Losing FIELD_ENCRYPTION_KEY makes them unreadable for good, so back it up.
const VERSION = 'v1';

const getKey = (): Buffer => {
  const key = Buffer.from(process.env.FIELD_ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes, encoded as base64.');
  return key;
};

export const encryptField = (value: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
};

export const decryptField = (value: string): string => {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== VERSION || !iv || !tag || encrypted === undefined) throw new Error('Unrecognised encrypted value.');

  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};
