import { Controller, Get, Post, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { PayrollRunsService } from './payroll-runs.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Payroll Runs')
@ApiSecurity('session')
@ApiSecurity('signed-request')
@Controller('payroll-runs')
export class PayrollRunsController {
  constructor(private readonly payrollRunsService: PayrollRunsService) {}

  @Get('profiles')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'List payroll profiles', description: 'Retrieves all payroll profiles for the specified employer.' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Wallet address of the employer' })
  @ApiResponse({ status: 200, description: 'Profiles retrieved successfully', schema: { type: 'object', properties: { profiles: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, employerWallet: { type: 'string' }, name: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listProfiles(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const profiles = await this.payrollRunsService.listProfiles(employerWallet);
      return response.json({ profiles });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('profiles')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Create or update payroll profile', description: 'Creates a new payroll profile or updates an existing one for the employer.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'name'], properties: { id: { type: 'string' }, employerWallet: { type: 'string' }, name: { type: 'string' }, settings: { type: 'object' } } } })
  @ApiResponse({ status: 201, description: 'Profile created/updated successfully', schema: { type: 'object', properties: { profile: { type: 'object', properties: { id: { type: 'string' }, employerWallet: { type: 'string' }, name: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async upsertProfile(@Body() body: any, @Res() response: Response) {
    try {
      const profile = await this.payrollRunsService.upsertProfile(body);
      return response.status(201).json({ profile });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('cycles')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'List payroll cycles', description: 'Retrieves all payroll cycles for the specified employer.' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Wallet address of the employer' })
  @ApiResponse({ status: 200, description: 'Cycles retrieved successfully', schema: { type: 'object', properties: { cycles: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, employerWallet: { type: 'string' }, label: { type: 'string' }, frequency: { type: 'string' }, periodStart: { type: 'string', format: 'date-time' }, periodEnd: { type: 'string', format: 'date-time' }, payDate: { type: 'string', format: 'date-time' }, status: { type: 'string' } } } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listCycles(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const cycles = await this.payrollRunsService.listCycles(employerWallet);
      return response.json({ cycles });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cycles')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Create a new payroll cycle', description: 'Creates a new payroll cycle with the specified period and frequency.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'label', 'frequency', 'periodStart', 'periodEnd', 'payDate'], properties: { employerWallet: { type: 'string' }, label: { type: 'string' }, frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'] }, periodStart: { type: 'string', format: 'date-time' }, periodEnd: { type: 'string', format: 'date-time' }, payDate: { type: 'string', format: 'date-time' } } } })
  @ApiResponse({ status: 201, description: 'Cycle created successfully', schema: { type: 'object', properties: { cycle: { type: 'object', properties: { id: { type: 'string' }, employerWallet: { type: 'string' }, label: { type: 'string' }, frequency: { type: 'string' }, periodStart: { type: 'string', format: 'date-time' }, periodEnd: { type: 'string', format: 'date-time' }, payDate: { type: 'string', format: 'date-time' }, status: { type: 'string' } } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCycle(@Body() body: any, @Res() response: Response) {
    try {
      const cycle = await this.payrollRunsService.createCycle({ employerWallet: body.employerWallet, createdByWallet: body.employerWallet, label: body.label, frequency: body.frequency, periodStart: body.periodStart, periodEnd: body.periodEnd, payDate: body.payDate });
      return response.status(201).json({ cycle });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cycles/:cycleId/compute')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Compute payroll cycle', description: 'Calculates payroll amounts for all employees in the specified cycle.' })
  @ApiParam({ name: 'cycleId', description: 'ID of the payroll cycle' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet'], properties: { employerWallet: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Cycle computed successfully', schema: { type: 'object', properties: { cycleId: { type: 'string' }, totalAmount: { type: 'number' }, employeeCount: { type: 'number' }, details: { type: 'array', items: { type: 'object' } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async computeCycle(@Param('cycleId') cycleId: string, @Body() body: any, @Res() response: Response) {
    try {
      const result = await this.payrollRunsService.computeCycle(body.employerWallet, cycleId);
      return response.json(result);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cycles/:cycleId/approve')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Approve payroll cycle', description: 'Approves the computed payroll cycle for disbursement.' })
  @ApiParam({ name: 'cycleId', description: 'ID of the payroll cycle' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet'], properties: { employerWallet: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Cycle approved successfully', schema: { type: 'object', properties: { cycle: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, approvedAt: { type: 'string', format: 'date-time' } } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async approveCycle(@Param('cycleId') cycleId: string, @Body() body: any, @Res() response: Response) {
    try {
      const cycle = await this.payrollRunsService.approveCycle(body.employerWallet, cycleId, body.employerWallet);
      return response.json({ cycle });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('cycles/:cycleId/disbursement-plan')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Get disbursement plan', description: 'Retrieves the disbursement plan for an approved payroll cycle.' })
  @ApiParam({ name: 'cycleId', description: 'ID of the payroll cycle' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Wallet address of the employer' })
  @ApiResponse({ status: 200, description: 'Disbursement plan retrieved successfully', schema: { type: 'object', properties: { cycleId: { type: 'string' }, totalDisbursement: { type: 'number' }, transactions: { type: 'array', items: { type: 'object', properties: { employeeWallet: { type: 'string' }, amount: { type: 'number' }, streamId: { type: 'string' } } } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async disbursementPlan(@Param('cycleId') cycleId: string, @Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const plan = await this.payrollRunsService.buildDisbursementPlan(employerWallet, cycleId);
      return response.json(plan);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('runs')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'List payroll runs', description: 'Retrieves all historical payroll runs for the specified employer, sorted by creation date.' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Wallet address of the employer' })
  @ApiResponse({ status: 200, description: 'Payroll runs retrieved successfully', schema: { type: 'object', properties: { runs: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, employerWallet: { type: 'string' }, cycleId: { type: 'string' }, status: { type: 'string' }, totalAmount: { type: 'number' }, createdAt: { type: 'string', format: 'date-time' } } } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listRuns(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const runs = await this.db().collection('payroll_runs_real').find({ employerWallet }).sort({ createdAt: -1 }).toArray();
      return response.json({ runs });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  private db() { return (this.payrollRunsService as any).db; }
}