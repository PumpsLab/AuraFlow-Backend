import { Controller, Get, Post, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PayrollRunsService } from './payroll-runs.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Payroll Runs')
@Controller('payroll-runs')
export class PayrollRunsController {
  constructor(private readonly payrollRunsService: PayrollRunsService) {}

  @Get('profiles')
  @UseGuards(WalletAuthGuard)
  async listProfiles(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const profiles = await this.payrollRunsService.listProfiles(employerWallet);
      return response.json({ profiles });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('profiles')
  @UseGuards(WalletAuthGuard)
  async upsertProfile(@Body() body: any, @Res() response: Response) {
    try {
      const profile = await this.payrollRunsService.upsertProfile(body);
      return response.status(201).json({ profile });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('cycles')
  @UseGuards(WalletAuthGuard)
  async listCycles(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const cycles = await this.payrollRunsService.listCycles(employerWallet);
      return response.json({ cycles });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cycles')
  @UseGuards(WalletAuthGuard)
  async createCycle(@Body() body: any, @Res() response: Response) {
    try {
      const cycle = await this.payrollRunsService.createCycle({ employerWallet: body.employerWallet, createdByWallet: body.employerWallet, label: body.label, frequency: body.frequency, periodStart: body.periodStart, periodEnd: body.periodEnd, payDate: body.payDate });
      return response.status(201).json({ cycle });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cycles/:cycleId/compute')
  @UseGuards(WalletAuthGuard)
  async computeCycle(@Param('cycleId') cycleId: string, @Body() body: any, @Res() response: Response) {
    try {
      const result = await this.payrollRunsService.computeCycle(body.employerWallet, cycleId);
      return response.json(result);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cycles/:cycleId/approve')
  @UseGuards(WalletAuthGuard)
  async approveCycle(@Param('cycleId') cycleId: string, @Body() body: any, @Res() response: Response) {
    try {
      const cycle = await this.payrollRunsService.approveCycle(body.employerWallet, cycleId, body.employerWallet);
      return response.json({ cycle });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('cycles/:cycleId/disbursement-plan')
  @UseGuards(WalletAuthGuard)
  async disbursementPlan(@Param('cycleId') cycleId: string, @Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const plan = await this.payrollRunsService.buildDisbursementPlan(employerWallet, cycleId);
      return response.json(plan);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('runs')
  @UseGuards(WalletAuthGuard)
  async listRuns(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const runs = await this.db().collection('payroll_runs_real').find({ employerWallet }).sort({ createdAt: -1 }).toArray();
      return response.json({ runs });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  private db() { return (this.payrollRunsService as any).db; }
}
