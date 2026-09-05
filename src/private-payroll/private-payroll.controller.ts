import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PrivatePayrollService } from './private-payroll.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Private Payroll')
@Controller('private-payroll')
export class PrivatePayrollController {
  constructor(private readonly privatePayrollService: PrivatePayrollService) {}

  @Post('send')
  @UseGuards(WalletAuthGuard)
  async send(@Body() body: any, @Res() response: Response) {
    try {
      const result = await this.privatePayrollService.sendPrivatePayroll(body);
      return response.json({ ok: true, ...result });
    } catch (error: any) { return response.status(400).json({ ok: false, error: error.message }); }
  }
}
