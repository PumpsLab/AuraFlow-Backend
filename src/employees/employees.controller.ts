import { Controller, Get, Post, Patch, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Employees')
@ApiSecurity('session')
@ApiSecurity('signed-request')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'List employees for an employer', description: 'Returns all employees associated with the given employer wallet.' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Employer wallet address' })
  @ApiResponse({ status: 200, description: 'Employees listed successfully', schema: { properties: { employees: { type: 'array', items: { type: 'object' } } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing employerWallet' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Create an employee', description: 'Creates a new employee record and attempts vault initialization.' })
  @ApiBody({ schema: { properties: { employerWallet: { type: 'string' }, wallet: { type: 'string' }, name: { type: 'string' }, payrollMode: { type: 'string' }, notes: { type: 'string' }, department: { type: 'string' }, role: { type: 'string' }, compensationAmountUsd: { type: 'number' }, monthlySalaryUsd: { type: 'number' }, startDate: { type: 'string' } }, required: ['employerWallet', 'wallet', 'name'] } })
  @ApiResponse({ status: 201, description: 'Employee created successfully', schema: { properties: { employee: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Update an employee', description: 'Updates an existing employee record.' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiBody({ schema: { properties: { employerWallet: { type: 'string' }, payrollMode: { type: 'string' } }, required: ['employerWallet'] } })
  @ApiResponse({ status: 200, description: 'Employee updated successfully', schema: { properties: { employee: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing employerWallet' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Mark private recipient initialized', description: 'Records that a private recipient vault has been initialized.' })
  @ApiBody({ schema: { properties: { employerWallet: { type: 'string' }, employeeWallet: { type: 'string' }, initializedAt: { type: 'string' }, txSignature: { type: 'string' } }, required: ['employerWallet', 'employeeWallet'] } })
  @ApiResponse({ status: 200, description: 'Private recipient initialized', schema: { properties: { message: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Auto-initialize employee vault', description: 'Sponsors vault initialization for an employee.' })
  @ApiBody({ schema: { properties: { employerWallet: { type: 'string' }, employeeWallet: { type: 'string' } }, required: ['employerWallet', 'employeeWallet'] } })
  @ApiResponse({ status: 200, description: 'Auto-init completed', schema: { properties: { message: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Auto-init did not complete' })
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
  @ApiOperation({ summary: 'Check private init status', description: 'Returns the initialization status of an employee wallet.' })
  @ApiQuery({ name: 'employeeWallet', required: true, description: 'Employee wallet address' })
  @ApiResponse({ status: 200, description: 'Init status retrieved', schema: { properties: { employeeWallet: { type: 'string' }, registered: { type: 'boolean' }, initialized: { type: 'boolean' }, status: { type: 'string', enum: ['confirmed', 'pending'] } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing employeeWallet' })
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
