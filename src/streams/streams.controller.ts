import { Controller, Get, Post, Patch, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { StreamsService } from './streams.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Streams')
@Controller('streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  @Get()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'List streams for an employer', description: 'Retrieves all streams associated with the specified employer wallet address.' })
  @ApiQuery({ name: 'employerWallet', required: true, description: 'Wallet address of the employer' })
  @ApiResponse({ status: 200, description: 'Streams retrieved successfully', schema: { type: 'object', properties: { streams: { type: 'array', items: { type: 'object' } } } } })
  @ApiResponse({ status: 400, description: 'Missing employerWallet parameter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      if (!employerWallet) return response.status(400).json({ error: 'Missing employerWallet' });
      const streams = await this.streamsService.list(employerWallet);
      return response.json({ streams });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Create a new stream', description: 'Creates a new payment stream between an employer and employee.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'employeeId', 'ratePerSecond', 'startsAt', 'endsAt'], properties: { employerWallet: { type: 'string' }, employeeId: { type: 'string' }, ratePerSecond: { type: 'number' }, startsAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time' }, payoutMode: { type: 'string' }, allowedPayoutModes: { type: 'array', items: { type: 'string' } }, status: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Stream created successfully', schema: { type: 'object', properties: { stream: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.create({ employerWallet: body.employerWallet || '', employeeId: body.employeeId || '', ratePerSecond: body.ratePerSecond || 0, startsAt: body.startsAt, endsAt: body.endsAt, payoutMode: body.payoutMode, allowedPayoutModes: body.allowedPayoutModes, status: body.status });
      return response.status(201).json({ stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch()
  @UseGuards(WalletAuthGuard)
  @ApiOperation({ summary: 'Update stream configuration', description: 'Updates the configuration of an existing stream including rate, payout mode, and status.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'streamId'], properties: { employerWallet: { type: 'string' }, streamId: { type: 'string' }, ratePerSecond: { type: 'number' }, payoutMode: { type: 'string' }, allowedPayoutModes: { type: 'array', items: { type: 'string' } }, status: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Stream updated successfully', schema: { type: 'object', properties: { stream: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.updateConfig(body.employerWallet, body.streamId, { ratePerSecond: body.ratePerSecond, payoutMode: body.payoutMode, allowedPayoutModes: body.allowedPayoutModes, status: body.status });
      return response.json({ stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('control')
  @ApiOperation({ summary: 'Control stream action (pause/resume/stop)', description: 'Determines the next status for a stream based on the provided action.' })
  @ApiBody({ schema: { type: 'object', required: ['streamId', 'action'], properties: { streamId: { type: 'string' }, action: { type: 'string', enum: ['pause', 'resume', 'stop'] } } } })
  @ApiResponse({ status: 200, description: 'Stream control action processed', schema: { type: 'object', properties: { ok: { type: 'boolean' }, nextStatus: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 404, description: 'Stream not found' })
  async controlPost(@Body() body: any, @Res() response: Response) {
    try {
      const { streamId, action } = body;
      const stream = await this.streamsService.findByStreamId(streamId);
      if (!stream) return response.status(404).json({ error: 'Stream not found' });
      const nextStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'stopped';
      return response.json({ ok: true, nextStatus });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch('control')
  @ApiOperation({ summary: 'Update stream control status', description: 'Updates the stream status and optionally the rate per second based on the provided action.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'streamId', 'action'], properties: { employerWallet: { type: 'string' }, streamId: { type: 'string' }, action: { type: 'string', enum: ['pause', 'resume', 'stop'] }, ratePerSecond: { type: 'number' } } } })
  @ApiResponse({ status: 200, description: 'Stream control updated successfully', schema: { type: 'object', properties: { ok: { type: 'boolean' }, stream: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async controlPatch(@Body() body: any, @Res() response: Response) {
    try {
      const nextStatus = body.action === 'pause' ? 'paused' : body.action === 'resume' ? 'active' : 'stopped';
      const stream = await this.streamsService.updateConfig(body.employerWallet, body.streamId, { status: nextStatus as any, ratePerSecond: body.ratePerSecond });
      return response.json({ ok: true, stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('onboard')
  @ApiOperation({ summary: 'Onboard employee to stream', description: 'Associates employee PDA, private payroll PDA, and permission PDA with a stream.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'streamId'], properties: { employerWallet: { type: 'string' }, streamId: { type: 'string' }, employeePda: { type: 'string' }, privatePayrollPda: { type: 'string' }, permissionPda: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Stream onboarded successfully', schema: { type: 'object', properties: { ok: { type: 'boolean' }, message: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async onboardPost(@Body() body: any, @Res() response: Response) {
    try {
      const { employerWallet, streamId, employeePda, privatePayrollPda, permissionPda } = body;
      await this.streamsService.updateRuntimeState(employerWallet, streamId, { employeePda: employeePda || '', privatePayrollPda: privatePayrollPda || '', permissionPda: permissionPda || '', delegatedAt: new Date().toISOString(), recipientPrivateInitializedAt: new Date().toISOString() });
      return response.json({ ok: true, message: 'Stream onboarded' });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch('onboard')
  @ApiOperation({ summary: 'Update stream onboarding details', description: 'Updates the PDA associations and timestamps for an existing stream.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'streamId'], properties: { employerWallet: { type: 'string' }, streamId: { type: 'string' }, employeePda: { type: 'string' }, privatePayrollPda: { type: 'string' }, permissionPda: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Stream onboarding updated successfully', schema: { type: 'object', properties: { ok: { type: 'boolean' }, stream: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async onboardPatch(@Body() body: any, @Res() response: Response) {
    try {
      const { employerWallet, streamId, employeePda, privatePayrollPda, permissionPda } = body;
      const stream = await this.streamsService.updateRuntimeState(employerWallet, streamId, { employeePda, privatePayrollPda, permissionPda, delegatedAt: new Date().toISOString(), recipientPrivateInitializedAt: new Date().toISOString() });
      return response.json({ ok: true, stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('restart')
  @ApiOperation({ summary: 'Restart stream', description: 'Checks if a stream exists and prepares it for restart.' })
  @ApiBody({ schema: { type: 'object', required: ['streamId'], properties: { streamId: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Stream restart initiated', schema: { type: 'object', properties: { ok: { type: 'boolean' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 404, description: 'Stream not found' })
  async restartPost(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.findByStreamId(body.streamId);
      if (!stream) return response.status(404).json({ error: 'Stream not found' });
      return response.json({ ok: true });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch('restart')
  @ApiOperation({ summary: 'Restart stream with active status', description: 'Sets the stream status to active to restart it.' })
  @ApiBody({ schema: { type: 'object', required: ['employerWallet', 'streamId'], properties: { employerWallet: { type: 'string' }, streamId: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Stream restarted successfully', schema: { type: 'object', properties: { ok: { type: 'boolean' }, stream: { type: 'object' } } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async restartPatch(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.updateConfig(body.employerWallet, body.streamId, { status: 'active' });
      return response.json({ ok: true, stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}