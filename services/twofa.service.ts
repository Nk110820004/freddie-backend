import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

export interface TwoFASecret {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

class TwoFAService {
  async generateSecret(email: string): Promise<TwoFASecret> {
    const secret = speakeasy.generateSecret({
      name: `Freddy Admin Panel (${email})`,
      length: 32,
    });

    const qrCode = await qrcode.toDataURL(secret.otpauth_url!);

    const backupCodes = Array.from({ length: 5 }).map(() =>
      Math.random().toString(36).slice(-10)
    );

    return { secret: secret.base32, qrCode, backupCodes };
  }

  verifyToken(secret: string, token: string): { valid: boolean } {
    const valid = speakeasy.totp.verify({
      secret,
      token,
      window: 1,
    });

    return { valid };
  }
}

export const twoFAService = new TwoFAService();
