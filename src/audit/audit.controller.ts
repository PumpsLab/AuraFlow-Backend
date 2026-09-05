import { Controller, Get, Post, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Audit')
@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('audit')
  async getAudit(@Query('token') token: string, @Res() response: Response) {
    try {
      if (!token) return response.status(400).json({ error: 'Missing token' });
      const data = await this.auditService.getAuditData(token);
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('auditor-tokens')
  @UseGuards(WalletAuthGuard)
  async listTokens(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const tokens = await this.auditService.listTokens(employerWallet);
      return response.json({ tokens });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('auditor-tokens')
  @UseGuards(WalletAuthGuard)
  async createToken(@Body() body: { employerWallet: string; label?: string }, @Res() response: Response) {
    try {
      const token = await this.auditService.createToken(body.employerWallet, body.label);
      return response.status(201).json({ token });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Delete('auditor-tokens')
  @UseGuards(WalletAuthGuard)
  async revokeToken(@Body() body: { id: string }, @Res() response: Response) {
    try {
      await this.auditService.revokeToken(body.id);
      return response.json({ ok: true });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('auditor-tokens/:token')
  async validateToken(@Param('token') token: string, @Res() response: Response) {
    try {
      const data = await this.auditService.validateToken(token);
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
