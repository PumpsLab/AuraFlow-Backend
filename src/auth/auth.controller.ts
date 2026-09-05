import { Controller, Post, Req, Res, Body, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { verifySignedWalletRequest } from '../common/wallet-auth.util';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('session')
  @ApiOperation({ summary: 'Create a session for a wallet', description: 'Authenticates a wallet via signed request and returns a session token.' })
  @ApiBody({ schema: { properties: { wallet: { type: 'string', description: 'The wallet address to create a session for' } }, required: ['wallet'] } })
  @ApiResponse({ status: 200, description: 'Session created successfully', schema: { properties: { wallet: { type: 'string' }, sessionToken: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing wallet or invalid signature' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSession(@Req() request: Request, @Body() body: { wallet?: string }, @Res() response: Response) {
    try {
      const wallet = body.wallet?.trim();
      if (!wallet) throw new Error('wallet is required');

      const rawBody = JSON.stringify(body);

      await verifySignedWalletRequest({
        headers: request.headers as Record<string, string>,
        expectedWallet: wallet,
        method: request.method,
        path: '/api/v1/auth/session',
        body: rawBody,
      });

      const session = this.authService.createSession(wallet);
      return response.json({ wallet, sessionToken: session.sessionToken, expiresAt: session.expiresAt });
    } catch (error: any) {
      return response.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to create session' });
    }
  }
}
