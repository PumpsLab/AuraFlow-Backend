import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';

@ApiTags('Compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('events')
  @ApiOperation({ summary: 'List compliance events for a wallet' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Wallet address to query events for' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of events to return (default: 25)' })
  @ApiResponse({ status: 200, description: 'Returns list of compliance events', schema: { example: { events: [{ type: 'payroll_sent', timestamp: '2025-01-01T00:00:00Z', details: { amount: 1000, recipient: '0x123...' } }] } } })
  @ApiResponse({ status: 400, description: 'Missing wallet or bad request' })
  async listEvents(@Query('wallet') wallet: string, @Query('limit') limit: string, @Res() response: Response) {
    try {
      if (!wallet) return response.status(400).json({ error: 'Missing wallet' });
      const events = await this.complianceService.listEvents(wallet, parseInt(limit) || 25);
      return response.json({ events });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('export')
  @ApiOperation({ summary: 'Export compliance data for a wallet' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Wallet address to export data for' })
  @ApiQuery({ name: 'scope', required: false, description: 'Export scope: "owner" or "all" (default: "owner")' })
  @ApiResponse({ status: 200, description: 'Returns exported compliance data', schema: { example: { wallet: '0x123...', events: [{ type: 'payroll_sent', timestamp: '2025-01-01T00:00:00Z' }] } } })
  @ApiResponse({ status: 400, description: 'Missing wallet or bad request' })
  async exportData(@Query('wallet') wallet: string, @Query('scope') scope: string, @Res() response: Response) {
    try {
      if (!wallet) return response.status(400).json({ error: 'Missing wallet' });
      const data = await this.complianceService.exportData(wallet, scope || 'owner');
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
