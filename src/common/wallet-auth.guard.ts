import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AURAFLOW_SESSION_HEADER, AURAFLOW_AUTH_WALLET_HEADER, AURAFLOW_AUTH_TIMESTAMP_HEADER, AURAFLOW_AUTH_SIGNATURE_HEADER } from './wallet-auth.types';
import { verifyWalletSessionToken, verifySignedWalletRequest, sha256Hex } from './wallet-auth.util';

@Injectable()
export class WalletAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionToken = request.headers[AURAFLOW_SESSION_HEADER];

    if (sessionToken) {
      const walletFromQuery = request.query?.employerWallet || request.query?.wallet || '';
      const walletFromBody = request.body?.employerWallet || request.body?.wallet || '';
      const expectedWallet = walletFromQuery || walletFromBody;
      if (expectedWallet) {
        try {
          verifyWalletSessionToken(sessionToken, expectedWallet);
          return true;
        } catch { /* fall through to signed request */ }
      }
    }

    const wallet = request.headers[AURAFLOW_AUTH_WALLET_HEADER];
    const timestamp = request.headers[AURAFLOW_AUTH_TIMESTAMP_HEADER];
    const signature = request.headers[AURAFLOW_AUTH_SIGNATURE_HEADER];

    if (wallet && timestamp && signature) {
      const walletFromQuery = request.query?.employerWallet || request.query?.wallet || '';
      const walletFromBody = request.body?.employerWallet || request.body?.wallet || '';
      const expectedWallet = walletFromQuery || walletFromBody;
      if (expectedWallet) {
        try {
          let body: string | undefined;
          if (request.method !== 'GET' && request.body) {
            body = JSON.stringify(request.body);
          }
          await verifySignedWalletRequest({
            headers: request.headers as Record<string, string>,
            expectedWallet,
            method: request.method,
            path: request.originalUrl,
            body,
          });
          return true;
        } catch { /* fall through */ }
      }
    }

    throw new UnauthorizedException('Unauthorized');
  }
}
