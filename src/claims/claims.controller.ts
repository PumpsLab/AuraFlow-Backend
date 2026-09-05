import { Controller, Get, Post, Patch, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { ClaimsService } from './claims.service';

@ApiTags('Claims')
@ApiSecurity('session')
@ApiSecurity('signed-request')
@Controller()
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get('claim/balance')
  @ApiOperation({ summary: 'Get claim balance for an employee' })
  @ApiQuery({ name: 'employeeWallet', required: true, description: 'Wallet address of the employee' })
  @ApiResponse({ status: 200, description: 'Returns the claim balance', schema: { example: { balance: 1500.00 } } })
  @ApiResponse({ status: 400, description: 'Missing employeeWallet parameter' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getClaimBalance(@Query('employeeWallet') employeeWallet: string, @Res() response: Response) {
    try {
      if (!employeeWallet) return response.status(400).json({ error: 'Missing employeeWallet' });
      const data = await this.claimsService.getClaimBalance(employeeWallet);
      return response.json(data);
    } catch (error: any) { return response.status(500).json({ error: error.message }); }
  }

  @Get('cashout-requests')
  @ApiOperation({ summary: 'List all cashout requests' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'employeeWallet', required: false, description: 'Filter by employee wallet' })
  @ApiResponse({ status: 200, description: 'Returns list of cashout requests', schema: { example: { requests: [{ id: '1', amount: 500, status: 'pending', employeeWallet: '0x123...' }] } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async listCashout(@Query() query: any, @Res() response: Response) {
    try {
      const requests = await this.claimsService.listCashoutRequests(query);
      return response.json({ requests });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('cashout-requests')
  @ApiOperation({ summary: 'Create a new cashout request' })
  @ApiBody({ schema: { properties: { employeeWallet: { type: 'string', example: '0x123...' }, amount: { type: 'number', example: 500 } }, required: ['employeeWallet', 'amount'] } })
  @ApiResponse({ status: 201, description: 'Cashout request created', schema: { example: { request: { id: '1', amount: 500, status: 'pending' } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createCashout(@Body() body: any, @Res() response: Response) {
    try {
      const request = await this.claimsService.createCashoutRequest(body);
      return response.status(201).json({ request });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch('cashout-requests')
  @ApiOperation({ summary: 'Resolve a cashout request' })
  @ApiBody({ schema: { properties: { id: { type: 'string', example: '1' }, status: { type: 'string', enum: ['approved', 'rejected'], example: 'approved' }, resolvedByWallet: { type: 'string', example: '0x456...' }, resolutionNote: { type: 'string', example: 'Approved after review' } }, required: ['id', 'status'] } })
  @ApiResponse({ status: 200, description: 'Cashout request resolved', schema: { example: { request: { id: '1', status: 'approved' } } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async resolveCashout(@Body() body: any, @Res() response: Response) {
    try {
      const request = await this.claimsService.resolveCashoutRequest(body.id, { status: body.status, resolvedByWallet: body.resolvedByWallet, resolutionNote: body.resolutionNote });
      return response.json({ request });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('claim-salary/process')
  @ApiOperation({ summary: 'Process a claim salary request' })
  @ApiBody({ schema: { properties: { employeeWallet: { type: 'string', example: '0x123...' }, amount: { type: 'number', example: 1000 } }, required: ['employeeWallet', 'amount'] } })
  @ApiResponse({ status: 200, description: 'Claim salary processed successfully', schema: { example: { txHash: '0xabc...', status: 'success' } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async processClaim(@Body() body: any, @Res() response: Response) {
    try {
      const result = await this.claimsService.processClaimSalary(body);
      return response.json(result);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('claim-salary/request')
  @ApiOperation({ summary: 'Request a claim salary (mock endpoint)' })
  @ApiBody({ schema: { properties: { employeeWallet: { type: 'string', example: '0x123...' }, amount: { type: 'number', example: 1000 } }, required: ['employeeWallet', 'amount'] } })
  @ApiResponse({ status: 200, description: 'Mock response', schema: { example: { ok: true, message: 'mock' } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async requestClaim(@Body() body: any, @Res() response: Response) {
    return response.json({ ok: true, message: 'mock' });
  }

  @Post('claim-salary/cancel')
  @ApiOperation({ summary: 'Cancel a claim salary request' })
  @ApiBody({ schema: { properties: { streamId: { type: 'string', example: '1' } }, required: ['streamId'] } })
  @ApiResponse({ status: 200, description: 'Claim salary cancelled', schema: { example: { ok: true, txHash: '0xdef...' } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async cancelClaim(@Body() body: any, @Res() response: Response) {
    try {
      const result = await this.claimsService.cancelClaimSalary(body.streamId);
      return response.json(result);
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
