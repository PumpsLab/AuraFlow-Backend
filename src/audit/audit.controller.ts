import { Controller, Get, Post, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Audit')
@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('audit')
  @ApiOperation({ summary: 'Get audit data by token' })
  @ApiQuery({ name: 'token', required: true, description: 'Audit access token' })
  @ApiResponse({ status: 200, description: 'Returns audit data', schema: { example: { payrollEntries: [{ date: '2025-01-01', employee: '0x123...', amount: 1000 }] } } })
  @ApiResponse({ status: 400, description: 'Missing token or bad request' })
  async getAudit(@Query('token') token: string, @Res() response: Response) {
    try {
      if (!token) return response.status(400).json({ error: 'Missing token' });
      const data = await this.auditService.getAuditData(token);
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('auditor-tokens')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'List all auditor tokens for an employer' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Wallet address of the employer' })
  @ApiResponse({ status: 200, description: 'Returns list of auditor tokens', schema: { example: { tokens: [{ id: '1', token: 'abc...', label: 'Auditor 1', createdAt: '2025-01-01' }] } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid wallet signature' })
  async listTokens(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      const tokens = await this.auditService.listTokens(employerWallet);
      return response.json({ tokens });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('auditor-tokens')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Create a new auditor token' })
  @ApiBody({ schema: { properties: { employerWallet: { type: 'string', example: '0x456...' }, label: { type: 'string', example: 'External Auditor' } }, required: ['employerWallet'] } })
  @ApiResponse({ status: 201, description: 'Auditor token created', schema: { example: { token: { id: '1', token: 'abc...', label: 'External Auditor' } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid wallet signature' })
  async createToken(@Body() body: { employerWallet: string; label?: string }, @Res() response: Response) {
    try {
      const token = await this.auditService.createToken(body.employerWallet, body.label);
      return response.status(201).json({ token });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Delete('auditor-tokens')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Revoke an auditor token' })
  @ApiBody({ schema: { properties: { id: { type: 'string', example: '1' } }, required: ['id'] } })
  @ApiResponse({ status: 200, description: 'Token revoked successfully', schema: { example: { ok: true } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid wallet signature' })
  async revokeToken(@Body() body: { id: string }, @Res() response: Response) {
    try {
      await this.auditService.revokeToken(body.id);
      return response.json({ ok: true });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Get('auditor-tokens/:token')
  @ApiOperation({ summary: 'Validate an auditor token' })
  @ApiParam({ name: 'token', description: 'The auditor token to validate' })
  @ApiResponse({ status: 200, description: 'Returns token validation result', schema: { example: { valid: true, employerWallet: '0x456...' } } })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  async validateToken(@Param('token') token: string, @Res() response: Response) {
    try {
      const data = await this.auditService.validateToken(token);
      return response.json(data);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
