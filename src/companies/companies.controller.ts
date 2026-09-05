import { Controller, Get, Post, Body, Param, Query, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CurrentWallet } from '../common/current-wallet.decorator';
import { WalletAuthGuard } from '../common/wallet-auth.guard';
import { UseGuards } from '@nestjs/common';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Create a new company', description: 'Registers a new company for payroll operations.' })
  @ApiBody({ schema: { properties: { name: { type: 'string' }, employerWallet: { type: 'string' }, message: { type: 'string' }, signature: { type: 'string' } }, required: ['name', 'employerWallet'] } })
  @ApiResponse({ status: 200, description: 'Company created successfully', schema: { properties: { ok: { type: 'boolean', example: true }, company: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() body: { name?: string; employerWallet?: string; message?: string; signature?: string }, @Res() response: Response) {
    try {
      if (!body.name) return response.status(400).json({ ok: false, error: 'Missing company name' });
      if (!body.employerWallet) return response.status(400).json({ ok: false, error: 'Missing employerWallet' });
      const company = await this.companiesService.create({ name: body.name, employerWallet: body.employerWallet, message: body.message, signature: body.signature });
      return response.json({ ok: true, company });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }

  @Get('me')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Get current user company', description: 'Returns the company associated with the given employer wallet.' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Employer wallet address' })
  @ApiResponse({ status: 200, description: 'Company found', schema: { properties: { ok: { type: 'boolean', example: true }, company: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – missing employerWallet' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      if (!employerWallet) return response.status(400).json({ ok: false, error: 'Missing employerWallet' });
      const company = await this.companiesService.getPublicCompany(employerWallet);
      return response.json({ ok: true, company });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }

  @Get(':companyId/balance')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Get company treasury balance', description: 'Returns the balance of the company treasury wallet.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Balance retrieved', schema: { properties: { ok: { type: 'boolean', example: true }, balance: { type: 'string' }, location: { type: 'string', example: 'ephemeral' } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async balance(@Param('companyId') companyId: string, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });
      const balance = await this.companiesService.getTreasuryBalance(companyId);
      return response.json({ ok: true, balance, location: 'ephemeral' });
    } catch (error: any) {
      return response.status(500).json({ ok: false, error: error.message });
    }
  }

  @Get(':companyId/treasury')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Get company treasury details', description: 'Returns treasury public keys and currency info for the company.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Treasury details retrieved', schema: { properties: { ok: { type: 'boolean', example: true }, treasury: { type: 'object', properties: { companyId: { type: 'string' }, currency: { type: 'string' }, treasuryPubkey: { type: 'string' }, settlementPubkey: { type: 'string' } } } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async treasury(@Param('companyId') companyId: string, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });
      return response.json({ ok: true, treasury: { companyId: company.id, currency: company.currency, treasuryPubkey: company.treasuryPubkey, settlementPubkey: company.settlementPubkey } });
    } catch (error: any) {
      return response.status(500).json({ ok: false, error: error.message });
    }
  }

  @Post(':companyId/withdraw')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Withdraw from company treasury', description: 'Transfers funds from the company treasury to a destination address.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiBody({ schema: { properties: { amount: { type: 'number' }, destinationAddress: { type: 'string' } }, required: ['amount', 'destinationAddress'] } })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Withdrawal initiated', schema: { properties: { ok: { type: 'boolean', example: true }, txHash: { type: 'string' }, amount: { type: 'number' } } } })
  @ApiResponse({ status: 400, description: 'Bad request – invalid amount or missing destination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async withdraw(@Param('companyId') companyId: string, @Body() body: { amount?: number; destinationAddress?: string }, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      if (!body.amount || typeof body.amount !== 'number') return response.status(400).json({ ok: false, error: 'Invalid amount' });
      if (!body.destinationAddress) return response.status(400).json({ ok: false, error: 'Missing destinationAddress' });
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });
      await this.companiesService.loadPrivateKey(companyId, 'treasury');
      return response.json({ ok: true, txHash: 'mock_stellar_tx_hash_pending_real_implementation', amount: body.amount });
    } catch (error: any) {
      return response.status(500).json({ ok: false, error: error.message });
    }
  }

  @Get(':companyId/funding-instructions')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Get funding instructions', description: 'Returns instructions for funding the company payroll treasury.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Funding instructions retrieved', schema: { properties: { ok: { type: 'boolean', example: true }, instructions: { type: 'object', properties: { title: { type: 'string' }, currency: { type: 'string' }, treasuryPubkey: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } } } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async fundingInstructions(@Param('companyId') companyId: string, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });
      return response.json({ ok: true, instructions: { title: 'Fund company payroll treasury', currency: company.currency, treasuryPubkey: company.treasuryPubkey, steps: ['Send USDC to the treasury address.', 'After funding, use payroll to settle claims.', 'Only fund payroll budget.'] } });
    } catch (error: any) {
      return response.status(500).json({ ok: false, error: error.message });
    }
  }
}
