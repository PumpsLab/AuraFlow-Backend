import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AURAFLOW_SESSION_HEADER, AURAFLOW_AUTH_WALLET_HEADER } from './wallet-auth.types';
import { extractSessionWallet, verifyWalletSessionToken } from './wallet-auth.util';

export const CurrentWallet = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const sessionToken = request.headers[AURAFLOW_SESSION_HEADER];
  if (sessionToken) {
    const wallet = extractSessionWallet(sessionToken);
    if (wallet) return wallet;
  }
  const walletHeader = request.headers[AURAFLOW_AUTH_WALLET_HEADER];
  return walletHeader?.trim() || '';
});
