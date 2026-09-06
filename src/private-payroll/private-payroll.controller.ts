import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiSecurity } from '@nestjs/swagger';
import { PrivatePayrollService } from './private-payroll.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Private Payroll')
@ApiSecurity('session')
@ApiSecurity('signed-request')
@Controller('private-payroll')
export class PrivatePayrollController {
  constructor(private readonly privatePayrollService: PrivatePayrollService) {}

  @Post('build-transaction')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Build payroll transaction XDR', description: 'Builds a Soroban transaction for payroll batch and returns XDR for frontend signing.' })
  @ApiBody({ schema: {
    properties: {
      employerWallet: { type: 'string', example: 'GBUZ2ITYH7YN3SOBZ2POSGRYONBDZRYONPEWHH45X5HMZ3VRJGECB3GP' },
      payPeriod: { type: 'string', example: '2026-09' },
      recipients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            name: { type: 'string', example: 'John Doe' },
            address: { type: 'string', example: 'GC6LFYHR...' },
            amount: { type: 'number', example: 5000 },
          },
        },
      },
    },
    required: ['employerWallet', 'payPeriod', 'recipients'],
  } })
  @ApiResponse({ status: 200, description: 'Transaction XDR built successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async buildTransaction(@Body() body: {
    employerWallet: string;
    payPeriod: string;
    recipients: Array<{ employeeId?: string; name?: string; address: string; amount: number }>;
  }, @Res() response: Response) {
    try {
      const result = await this.privatePayrollService.buildTransaction(body);
      return response.json({ ok: true, ...result });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }

  @Post('submit')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Submit signed payroll transaction', description: 'Submits a signed Soroban transaction to the Stellar network.' })
  @ApiBody({ schema: {
    properties: {
      signedXdr: { type: 'string', description: 'XDR transaction signed by employer wallet' },
    },
    required: ['signedXdr'],
  } })
  @ApiResponse({ status: 200, description: 'Transaction submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request – invalid XDR' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async submit(@Body() body: { signedXdr: string }, @Res() response: Response) {
    try {
      if (!body.signedXdr) return response.status(400).json({ ok: false, error: 'Missing signedXdr' });
      const result = await this.privatePayrollService.submitTransaction(body.signedXdr);
      return response.json({ ok: true, ...result });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }
}
