import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';

@ApiTags('Compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('events')
  async listEvents(@Query('wallet') wallet: string, @Query('limit') limit: string, @Res() response: Response) {
    try {
      if (!wallet) return response.status(400).json({ error: 'Missing wallet' });
      const events = await this.complianceService.listEvents(wallet, parseInt(limit) || 25);
      return response.json({ events });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('export')
  async exportData(@Query('wallet') wallet: string, @Query('scope') scope: string, @Res() response: Response) {
    try {
      if (!wallet) return response.status(400).json({ error: 'Missing wallet' });
      const data = await this.complianceService.exportData(wallet, scope || 'owner');
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
