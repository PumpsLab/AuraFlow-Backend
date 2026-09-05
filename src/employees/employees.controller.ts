import { Controller, Get, Post, Patch, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @UseGuards(WalletAuthGuard)
  async list(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      if (!employerWallet) return response.status(400).json({ error: 'Missing employerWallet' });
      const employees = await this.employeesService.listByEmployer(employerWallet);
      return response.json({ employees });
    } catch (error: any) {
      return response.status(400).json({ error: error.message });
    }
  }

  @Post()
  @UseGuards(WalletAuthGuard)
  async create(@Body() body: any, @Res() response: Response) {
    try {
      const employee = await this.employeesService.create({
        employerWallet: body.employerWallet || '', wallet: body.wallet || '', name: body.name || '',
        payrollMode: body.payrollMode, notes: body.notes, department: body.department, role: body.role,
        compensationAmountUsd: body.compensationAmountUsd, monthlySalaryUsd: body.monthlySalaryUsd,
        startDate: body.startDate,
      });
      try { await this.employeesService.sponsorInitializeVault(employee.wallet, body.employerWallet || ''); } catch {}
      return response.status(201).json({ employee });
    } catch (error: any) {
      return response.status(400).json({ error: error.message });
    }
  }

  @Patch(':id')
  @UseGuards(WalletAuthGuard)
  async update(@Param('id') id: string, @Body() body: any, @Res() response: Response) {
    try {
      if (!body.employerWallet) return response.status(400).json({ error: 'employerWallet required' });
      const updates: any = {};
      if (body.payrollMode) updates.payrollMode = body.payrollMode;
      const employee = await this.employeesService.update(body.employerWallet, id, updates);
      return response.json({ employee });
    } catch (error: any) {
      return response.status(400).json({ error: error.message });
    }
  }

  @Post('private-init')
  @UseGuards(WalletAuthGuard)
  async privateInit(@Body() body: any, @Res() response: Response) {
    try {
      const { employerWallet, employeeWallet, initializedAt, txSignature } = body;
      if (!employerWallet || !employeeWallet) return response.status(400).json({ error: 'Missing fields' });
      const result = await this.employeesService.markPrivateRecipientInitialized(employeeWallet, initializedAt, txSignature);
      return response.json({ message: 'Private recipient initialized', ...result });
    } catch (error: any) {
      return response.status(400).json({ error: error.message });
    }
  }

  @Post('auto-init')
  @UseGuards(WalletAuthGuard)
  async autoInit(@Body() body: any, @Res() response: Response) {
    try {
      const { employerWallet, employeeWallet } = body;
      if (!employerWallet || !employeeWallet) return response.status(400).json({ error: 'Missing fields' });
      const initialized = await this.employeesService.sponsorInitializeVault(employeeWallet, employerWallet);
      if (!initialized) return response.status(409).json({ error: 'Auto-init did not complete' });
      return response.json({ message: 'Auto-init completed' });
    } catch (error: any) {
      return response.status(400).json({ error: error.message });
    }
  }

  @Get('private-init-status')
  async privateInitStatus(@Query('employeeWallet') employeeWallet: string, @Res() response: Response) {
    try {
      if (!employeeWallet) return response.status(400).json({ error: 'Missing employeeWallet' });
      const employees = await this.employeesService.listByWallet(employeeWallet);
      const registered = employees.length > 0;
      return response.json({ employeeWallet, registered, initialized: registered, status: registered ? 'confirmed' : 'pending' });
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
}
