import crypto from 'crypto';

class EncryptionService {
  private readonly ALGO = 'aes-256-gcm';
  private readonly KEY: Buffer;

  constructor() {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY env variable is required');
    }

    this.KEY = crypto
      .createHash('sha256')
      .update(process.env.ENCRYPTION_KEY)
      .digest();
  }

  encryptToJson(plain: string): string {
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(this.ALGO, this.KEY, iv);

    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      value: encrypted.toString('hex'),
      tag: authTag.toString('hex'),
    });
  }

  decryptFromJson(payload: string): string {
    const data = JSON.parse(payload);

    const decipher = crypto.createDecipheriv(
      this.ALGO,
      this.KEY,
      Buffer.from(data.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data.value, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}

export const encryptionService = new EncryptionService();

class ApiKeyService {
  generateKey(): { key: string; keyHash: string; expiresAt: Date } {
    const key = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    return { key, keyHash, expiresAt };
  }
}

export const apiKeyService = new ApiKeyService();
