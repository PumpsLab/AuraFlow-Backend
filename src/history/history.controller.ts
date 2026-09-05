import { Controller, Get, Post, Delete, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('History')
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @UseGuards(WalletAuthGuard)
  async getHistory(@Query('wallet') wallet: string, @Query('scope') scope: string, @Res() response: Response) {
    try {
      if (!wallet) return response.status(400).json({ error: 'Missing wallet' });
      const data = await this.historyService.getHistory(wallet, scope);
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post()
  @UseGuards(WalletAuthGuard)
  async saveRecord(@Body() body: any, @Res() response: Response) {
    try {
      const record = await this.historyService.saveRecord(body);
      return response.status(201).json({ record });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Delete()
  @UseGuards(WalletAuthGuard)
  async clearHistory(@Query('wallet') wallet: string, @Res() response: Response) {
    try {
      await this.historyService.clearHistory(wallet);
      return response.json({ ok: true });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
