import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';

@ApiTags('Payroll')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('employee')
  @ApiOperation({ summary: 'Get employee payroll data', description: 'Retrieves payroll data for a specific employee based on their wallet address.' })
  @ApiQuery({ name: 'employeeWallet', required: true, description: 'Wallet address of the employee' })
  @ApiResponse({ status: 200, description: 'Employee payroll data retrieved successfully', schema: { type: 'object', properties: { employeeId: { type: 'string' }, totalEarned: { type: 'number' }, pendingPayout: { type: 'number' }, streams: { type: 'array', items: { type: 'object' } } } } })
  @ApiResponse({ status: 400, description: 'Missing employeeWallet parameter' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getEmployeePayroll(@Query('employeeWallet') employeeWallet: string, @Res() response: Response) {
    try {
      if (!employeeWallet) return response.status(400).json({ error: 'Missing employeeWallet' });
      const data = await this.payrollService.getEmployeePayrollData(employeeWallet);
      return response.json(data);
    } catch (error: any) { return response.status(500).json({ error: error.message }); }
  }

  @Get('state')
  @ApiOperation({ summary: 'Get stream state', description: 'Retrieves the current state of a specific stream for an employer.' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Wallet address of the employer' })
  @ApiQuery({ name: 'streamId', required: true, description: 'ID of the stream' })
  @ApiResponse({ status: 200, description: 'Stream state retrieved successfully', schema: { type: 'object', properties: { streamId: { type: 'string' }, status: { type: 'string' }, balance: { type: 'number' }, lastUpdated: { type: 'string', format: 'date-time' } } } })
  @ApiResponse({ status: 400, description: 'Missing employerWallet or streamId parameter' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getStreamState(@Query('employerWallet') employerWallet: string, @Query('streamId') streamId: string, @Res() response: Response) {
    try {
      if (!employerWallet || !streamId) return response.status(400).json({ error: 'Missing parameters' });
      const data = await this.payrollService.getStreamState(employerWallet, streamId);
      return response.json(data);
    } catch (error: any) { return response.status(500).json({ error: error.message }); }
  }
}