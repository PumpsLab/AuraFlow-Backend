import { Controller, Get, Post, Patch, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { StreamsService } from './streams.service';
import { UseGuards } from '@nestjs/common';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

@ApiTags('Streams')
@Controller('streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  @Get()
  @UseGuards(WalletAuthGuard)
  async list(@Query('employerWallet') employerWallet: string, @Res() response: Response) {
    try {
      if (!employerWallet) return response.status(400).json({ error: 'Missing employerWallet' });
      const streams = await this.streamsService.list(employerWallet);
      return response.json({ streams });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post()
  @UseGuards(WalletAuthGuard)
  async create(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.create({ employerWallet: body.employerWallet || '', employeeId: body.employeeId || '', ratePerSecond: body.ratePerSecond || 0, startsAt: body.startsAt, endsAt: body.endsAt, payoutMode: body.payoutMode, allowedPayoutModes: body.allowedPayoutModes, status: body.status });
      return response.status(201).json({ stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch()
  @UseGuards(WalletAuthGuard)
  async update(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.updateConfig(body.employerWallet, body.streamId, { ratePerSecond: body.ratePerSecond, payoutMode: body.payoutMode, allowedPayoutModes: body.allowedPayoutModes, status: body.status });
      return response.json({ stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('control')
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
  async controlPatch(@Body() body: any, @Res() response: Response) {
    try {
      const nextStatus = body.action === 'pause' ? 'paused' : body.action === 'resume' ? 'active' : 'stopped';
      const stream = await this.streamsService.updateConfig(body.employerWallet, body.streamId, { status: nextStatus as any, ratePerSecond: body.ratePerSecond });
      return response.json({ ok: true, stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('onboard')
  async onboardPost(@Body() body: any, @Res() response: Response) {
    try {
      const { employerWallet, streamId, employeePda, privatePayrollPda, permissionPda } = body;
      await this.streamsService.updateRuntimeState(employerWallet, streamId, { employeePda: employeePda || '', privatePayrollPda: privatePayrollPda || '', permissionPda: permissionPda || '', delegatedAt: new Date().toISOString(), recipientPrivateInitializedAt: new Date().toISOString() });
      return response.json({ ok: true, message: 'Stream onboarded' });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch('onboard')
  async onboardPatch(@Body() body: any, @Res() response: Response) {
    try {
      const { employerWallet, streamId, employeePda, privatePayrollPda, permissionPda } = body;
      const stream = await this.streamsService.updateRuntimeState(employerWallet, streamId, { employeePda, privatePayrollPda, permissionPda, delegatedAt: new Date().toISOString(), recipientPrivateInitializedAt: new Date().toISOString() });
      return response.json({ ok: true, stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Post('restart')
  async restartPost(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.findByStreamId(body.streamId);
      if (!stream) return response.status(404).json({ error: 'Stream not found' });
      return response.json({ ok: true });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }

  @Patch('restart')
  async restartPatch(@Body() body: any, @Res() response: Response) {
    try {
      const stream = await this.streamsService.updateConfig(body.employerWallet, body.streamId, { status: 'active' });
      return response.json({ ok: true, stream });
    } catch (error: any) { return response.status(400).json({ error: error.message }); }
  }
}
