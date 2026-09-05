import { Controller, Get, Post, Body, Param, Query, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
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
