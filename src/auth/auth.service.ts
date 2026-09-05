import { Injectable } from '@nestjs/common';
import { createWalletSessionToken, verifyWalletSessionToken } from '../common/wallet-auth.util';

@Injectable()
export class AuthService {
  createSession(wallet: string) {
    return createWalletSessionToken(wallet);
  }

  verifySession(sessionToken: string, expectedWallet: string) {
    return verifyWalletSessionToken(sessionToken, expectedWallet);
  }
}
