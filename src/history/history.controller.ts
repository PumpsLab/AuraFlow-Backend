import { Controller, Get, Post, Delete, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('History')
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Get payroll history for a wallet' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Wallet address to get history for' })
  @ApiQuery({ name: 'scope', required: false, description: 'History scope filter' })
  @ApiResponse({ status: 200, description: 'Returns payroll history', schema: { example: { records: [{ id: '1', type: 'payroll_sent', amount: 1000, timestamp: '2025-01-01T00:00:00Z' }] } } })
  @ApiResponse({ status: 400, description: 'Missing wallet or bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid wallet signature' })
  async getHistory(@Query('wallet') wallet: string, @Query('scope') scope: string, @Res() response: Response) {
    try {
      if (!wallet) return response.status(400).json({ error: 'Missing wallet' });
      const data = await this.historyService.getHistory(wallet, scope);
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Save a payroll history record' })
  @ApiBody({ schema: { properties: { wallet: { type: 'string', example: '0x123...' }, type: { type: 'string', example: 'payroll_sent' }, amount: { type: 'number', example: 1000 }, timestamp: { type: 'string', example: '2025-01-01T00:00:00Z' } }, required: ['wallet', 'type'] } })
  @ApiResponse({ status: 201, description: 'Record saved successfully', schema: { example: { record: { id: '1', wallet: '0x123...', type: 'payroll_sent', amount: 1000, timestamp: '2025-01-01T00:00:00Z' } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid wallet signature' })
  async saveRecord(@Body() body: any, @Res() response: Response) {
    try {
      const record = await this.historyService.saveRecord(body);
      return response.status(201).json({ record });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Delete()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Clear payroll history for a wallet' })
  @ApiQuery({ name: 'wallet', required: true, description: 'Wallet address to clear history for' })
  @ApiResponse({ status: 200, description: 'History cleared successfully', schema: { example: { ok: true } } })
  @ApiResponse({ status: 400, description: 'Missing wallet or bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid wallet signature' })
  async clearHistory(@Query('wallet') wallet: string, @Res() response: Response) {
    try {
      await this.historyService.clearHistory(wallet);
      return response.json({ ok: true });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
