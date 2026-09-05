import { Controller, Get, Post, Patch, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ClaimsService } from './claims.service';

@ApiTags('Claims')
@Controller()
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get('claim/balance')
  async getClaimBalance(@Query('employeeWallet') employeeWallet: string, @Res() response: Response) {
    try {
      if (!employeeWallet) return response.status(400).json({ error: 'Missing employeeWallet' });
      const data = await this.claimsService.getClaimBalance(employeeWallet);
      return response.json(data);
    } catch (error: any) { return response.status(500).json({ error: error.message }); }
  }

  @Get('cashout-requests')
  async listCashout(@Query() query: any, @Res() response: Response) {
    try {
      const requests = await this.claimsService.listCashoutRequests(query);
      return response.json({ requests });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cashout-requests')
  async createCashout(@Body() body: any, @Res() response: Response) {
    try {
      const request = await this.claimsService.createCashoutRequest(body);
      return response.status(201).json({ request });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch('cashout-requests')
  async resolveCashout(@Body() body: any, @Res() response: Response) {
    try {
      const request = await this.claimsService.resolveCashoutRequest(body.id, { status: body.status, resolvedByWallet: body.resolvedByWallet, resolutionNote: body.resolutionNote });
      return response.json({ request });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('claim-salary/process')
  async processClaim(@Body() body: any, @Res() response: Response) {
    try {
      const result = await this.claimsService.processClaimSalary(body);
      return response.json(result);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('claim-salary/request')
  async requestClaim(@Body() body: any, @Res() response: Response) {
    return response.json({ ok: true, message: 'mock' });
  }

  @Post('claim-salary/cancel')
  async cancelClaim(@Body() body: any, @Res() response: Response) {
    try {
      const result = await this.claimsService.cancelClaimSalary(body.streamId);
      return response.json(result);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
