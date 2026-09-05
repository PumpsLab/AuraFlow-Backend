import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';

@ApiTags('Payroll')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('employee')
  async getEmployeePayroll(@Query('employeeWallet') employeeWallet: string, @Res() response: Response) {
    try {
      if (!employeeWallet) return response.status(400).json({ error: 'Missing employeeWallet' });
      const data = await this.payrollService.getEmployeePayrollData(employeeWallet);
      return response.json(data);
    } catch (error: any) { return response.status(500).json({ error: error.message }); }
  }

  @Get('state')
  async getStreamState(@Query('employerWallet') employerWallet: string, @Query('streamId') streamId: string, @Res() response: Response) {
    try {
      if (!employerWallet || !streamId) return response.status(400).json({ error: 'Missing parameters' });
      const data = await this.payrollService.getStreamState(employerWallet, streamId);
      return response.json(data);
    } catch (error: any) { return response.status(500).json({ error: error.message }); }
  }
}
