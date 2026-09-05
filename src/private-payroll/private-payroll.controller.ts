import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PrivatePayrollService } from './private-payroll.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Private Payroll')
@Controller('private-payroll')
export class PrivatePayrollController {
  constructor(private readonly privatePayrollService: PrivatePayrollService) {}

  @Post('send')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Send private payroll to employees' })
  @ApiBody({ schema: { properties: { employerWallet: { type: 'string', example: '0x456...' }, employees: { type: 'array', items: { type: 'object', properties: { wallet: { type: 'string', example: '0x123...' }, amount: { type: 'number', example: 1000 } } }, example: [{ wallet: '0x123...', amount: 1000 }] } }, required: ['employerWallet', 'employees'] } })
  @ApiResponse({ status: 200, description: 'Payroll sent successfully', schema: { example: { ok: true, txHash: '0xabc...' } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid wallet signature' })
  async send(@Body() body: any, @Res() response: Response) {
    try {
      const result = await this.privatePayrollService.sendPrivatePayroll(body);
      return response.json({ ok: true, ...result });
    } catch (error: any) { return response.status(400).json({ ok: false, error: error.message }); }
  }
}
