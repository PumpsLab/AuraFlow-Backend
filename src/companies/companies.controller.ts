import { Controller, Get, Post, Body, Param, Query, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CurrentWallet } from '../common/current-wallet.decorator';
import { WalletAuthGuard } from '../common/wallet-auth.guard';
import { UseGuards } from '@nestjs/common';

@ApiTags('Companies')
@ApiSecurity('session')
@ApiSecurity('signed-request')
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
  @ApiOperation({ summary: 'Get company treasury balance', description: 'Returns XLM, USDC balances and trustline status of the company treasury wallet.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Balance retrieved', schema: { properties: { ok: { type: 'boolean', example: true }, balance: { type: 'object', properties: { xlm: { type: 'string', example: '10.0000000' }, usdc: { type: 'string', example: '5000.0000000' }, hasTrustline: { type: 'boolean', example: true } } } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async balance(@Param('companyId') companyId: string, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });
      const balance = await this.companiesService.getTreasuryBalance(companyId);
      return response.json({ ok: true, balance });
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
      const result = await this.companiesService.withdrawFromTreasury(companyId, body.amount, body.destinationAddress);
      return response.json({ ok: true, txHash: result.txHash, amount: body.amount });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }

  @Post(':companyId/setup-trustline')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Setup USDC trustline for treasury', description: 'Adds a USDC trustline to the treasury account. Treasury must have XLM for base reserve first.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Trustline created', schema: { properties: { ok: { type: 'boolean', example: true }, txHash: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async setupTrustline(@Param('companyId') companyId: string, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });
      const result = await this.companiesService.setupTrustline(companyId, wallet);
      return response.json({ ok: true, ...result });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }

  @Get(':companyId/funding-instructions')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Get funding instructions', description: 'Returns dynamic funding status with step-by-step instructions for treasury setup.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Funding instructions retrieved' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async fundingInstructions(@Param('companyId') companyId: string, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });

      const balance = await this.companiesService.getTreasuryBalance(companyId);
      const hasXlm = parseFloat(balance.xlm) >= 2;
      const hasTrustline = balance.hasTrustline;
      const hasUsdc = parseFloat(balance.usdc) > 0;

      const steps = [
        {
          step: 1,
          label: 'Fund XLM for base reserve',
          description: `Send at least 2 XLM to treasury address ${company.treasuryPubkey}`,
          status: hasXlm ? 'completed' : 'pending',
          treasuryPubkey: company.treasuryPubkey,
          xlmBalance: balance.xlm,
        },
        {
          step: 2,
          label: 'Setup USDC trustline',
          description: 'Backend will add USDC trustline to treasury account',
          status: !hasXlm ? 'blocked' : hasTrustline ? 'completed' : 'ready',
          requiresXlm: true,
        },
        {
          step: 3,
          label: 'Fund USDC for payroll',
          description: `Send USDC to treasury address ${company.treasuryPubkey}`,
          status: !hasTrustline ? 'blocked' : hasUsdc ? 'completed' : 'ready',
          treasuryPubkey: company.treasuryPubkey,
          usdcBalance: balance.usdc,
        },
      ];

      const isReady = hasXlm && hasTrustline && hasUsdc;

      return response.json({
        ok: true,
        treasuryPubkey: company.treasuryPubkey,
        currency: company.currency,
        isReady,
        steps,
      });
    } catch (error: any) {
      return response.status(500).json({ ok: false, error: error.message });
    }
  }

  @Post(':companyId/fund-treasury')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Build fund-treasury transaction', description: 'Builds an unsigned Soroban transaction to fund the on-chain treasury. The employer must sign with Freighter and submit via /fund-treasury/submit.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiBody({ schema: { properties: { amount: { type: 'number', description: 'Amount in USDC (e.g. 100.50)' } }, required: ['amount'] } })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Transaction built', schema: { properties: { ok: { type: 'boolean', example: true }, xdr: { type: 'string' }, networkPassphrase: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async buildFundTreasury(@Param('companyId') companyId: string, @Body() body: { amount?: number }, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
        return response.status(400).json({ ok: false, error: 'Invalid amount' });
      }
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });
      const amountMicro = Math.round(body.amount * 1_000_000);
      const result = await this.companiesService.buildFundTreasury(companyId, wallet, amountMicro);
      return response.json({ ok: true, ...result });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }

  @Post(':companyId/fund-treasury/submit')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Submit signed fund-treasury transaction', description: 'Submits a Freighter-signed fund-treasury transaction to the Soroban network.' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiBody({ schema: { properties: { signedXdr: { type: 'string' } }, required: ['signedXdr'] } })
  @ApiQuery({ name: 'wallet', required: true, description: 'Employer wallet address for authorization' })
  @ApiResponse({ status: 200, description: 'Transaction submitted' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async submitFundTreasury(@Param('companyId') companyId: string, @Body() body: { signedXdr?: string }, @Query('wallet') wallet: string, @Res() response: Response) {
    try {
      if (!body.signedXdr) return response.status(400).json({ ok: false, error: 'Missing signedXdr' });
      const company = await this.companiesService.findById(companyId);
      if (!company) return response.status(404).json({ ok: false, error: 'Company not found' });
      if (company.employerWallet !== wallet) return response.status(403).json({ ok: false, error: 'Unauthorized' });

      const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: body.signedXdr } }),
      });
      const data = await res.json();
      if (data.error) return response.status(400).json({ ok: false, error: `Soroban submit failed: ${JSON.stringify(data.error).slice(0, 500)}` });

      const result = data.result;
      if (result?.status === 'ERROR') {
        const errorResult = result.errorResult ? JSON.stringify(result.errorResult).slice(0, 2000) : '';
        return response.status(400).json({ ok: false, error: `Soroban submit failed: ${result.status} ${errorResult}`.trim() });
      }
      return response.json({ ok: true, txHash: result?.hash || '', status: result?.status || 'PENDING' });
    } catch (error: any) {
      return response.status(400).json({ ok: false, error: error.message });
    }
  }
}
