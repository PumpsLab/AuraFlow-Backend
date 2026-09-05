import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

export type PayrollStreamStatus = 'active' | 'paused' | 'stopped';
export type PayrollPayoutMode = 'base' | 'ephemeral';

export interface StreamRecord {
  id: string; employerWallet: string; employeeId: string; ratePerSecond: number;
  startsAt?: string | null; endsAt?: string | null; payoutMode?: PayrollPayoutMode;
  allowedPayoutModes?: PayrollPayoutMode[]; employeePda?: string; privatePayrollPda?: string;
  permissionPda?: string; delegatedAt?: string | null; recipientPrivateInitializedAt?: string | null;
  lastPaidAt: string | null; totalPaid: number; status: PayrollStreamStatus;
  createdAt: string; updatedAt: string;
}

function normalizeAllowedPayoutModes(modes?: PayrollPayoutMode[], fallback?: PayrollPayoutMode): PayrollPayoutMode[] {
  const normalized = Array.isArray(modes) ? (['base', 'ephemeral'] as const).filter(m => modes.includes(m)) : [];
  return normalized.length > 0 ? normalized : [fallback || 'base'];
}

@Injectable()
export class StreamsService {
  constructor(private readonly db: DatabaseService) {}
  private streams() { return this.db.collection('streams'); }

  async list(employerWallet: string) {
    return this.streams().find({ employerWallet: employerWallet.trim() }).sort({ createdAt: 1 }).toArray();
  }

  async listActive(employerWallet?: string) {
    const query: any = { status: 'active' };
    if (employerWallet) query.employerWallet = employerWallet.trim();
    return this.streams().find(query).sort({ updatedAt: 1 }).toArray();
  }

  async findById(employerWallet: string, streamId: string) {
    return this.streams().findOne({ employerWallet: employerWallet.trim(), id: streamId });
  }

  async findByStreamId(streamId: string) {
    return this.streams().findOne({ id: streamId });
  }

  async create(input: { employerWallet: string; employeeId: string; ratePerSecond: number; startsAt?: string | null; endsAt?: string | null; payoutMode?: PayrollPayoutMode; allowedPayoutModes?: PayrollPayoutMode[]; status?: PayrollStreamStatus }) {
    const ratePerSecond = input.ratePerSecond;
    if (!Number.isFinite(ratePerSecond) || ratePerSecond <= 0) throw new Error('Rate per second must be positive');
    const timestamp = new Date().toISOString();
    const startsAt = input.startsAt?.trim() ? new Date(input.startsAt).toISOString() : timestamp;
    const allowedPayoutModes = normalizeAllowedPayoutModes(input.allowedPayoutModes, input.payoutMode);
    const payoutMode = allowedPayoutModes.includes(input.payoutMode || 'base') ? (input.payoutMode || 'base') : allowedPayoutModes[0];

    const duplicate = await this.streams().findOne({ employerWallet: input.employerWallet.trim(), employeeId: input.employeeId, status: { $ne: 'stopped' } });
    if (duplicate) throw new Error('Active/paused stream exists for this employee');

    const stream: StreamRecord = {
      id: randomUUID(), employerWallet: input.employerWallet.trim(), employeeId: input.employeeId,
      ratePerSecond, startsAt, endsAt: input.endsAt ?? null, payoutMode, allowedPayoutModes,
      employeePda: undefined, privatePayrollPda: undefined, permissionPda: undefined,
      delegatedAt: null, recipientPrivateInitializedAt: null,
      lastPaidAt: input.status === 'active' || !input.status ? startsAt : null,
      totalPaid: 0, status: input.status ?? 'active',
      createdAt: timestamp, updatedAt: timestamp,
    };
    await this.streams().insertOne(stream);
    return stream;
  }

  async updateConfig(employerWallet: string, streamId: string, updates: { ratePerSecond?: number; payoutMode?: PayrollPayoutMode; allowedPayoutModes?: PayrollPayoutMode[]; status?: PayrollStreamStatus }) {
    const stream = await this.streams().findOne({ employerWallet: employerWallet.trim(), id: streamId });
    if (!stream) throw new Error('Stream not found');
    const updateFields: any = { updatedAt: new Date().toISOString() };
    if (typeof updates.ratePerSecond === 'number') updateFields.ratePerSecond = updates.ratePerSecond;
    if (updates.status) updateFields.status = updates.status;
    if (updates.payoutMode || updates.allowedPayoutModes) {
      const allowed = normalizeAllowedPayoutModes(updates.allowedPayoutModes ?? stream.allowedPayoutModes, updates.payoutMode ?? stream.payoutMode);
      updateFields.allowedPayoutModes = allowed;
      updateFields.payoutMode = allowed.includes(updates.payoutMode ?? stream.payoutMode ?? 'base') ? (updates.payoutMode ?? stream.payoutMode ?? 'base') : allowed[0];
    }
    await this.streams().updateOne({ employerWallet: employerWallet.trim(), id: streamId }, { $set: updateFields });
    return { ...stream, ...updateFields };
  }

  async updateRuntimeState(employerWallet: string, streamId: string, updates: { employeePda?: string; privatePayrollPda?: string; permissionPda?: string; delegatedAt?: string | null; recipientPrivateInitializedAt?: string | null; lastPaidAt?: string | null; totalPaid?: number }) {
    const stream = await this.streams().findOne({ employerWallet: employerWallet.trim(), id: streamId });
    if (!stream) throw new Error('Stream not found');
    const updateFields: any = { updatedAt: new Date().toISOString() };
    if (typeof updates.employeePda === 'string') updateFields.employeePda = updates.employeePda;
    if (typeof updates.privatePayrollPda === 'string') updateFields.privatePayrollPda = updates.privatePayrollPda;
    if (typeof updates.permissionPda === 'string') updateFields.permissionPda = updates.permissionPda;
    if (updates.delegatedAt !== undefined) updateFields.delegatedAt = updates.delegatedAt;
    if (updates.recipientPrivateInitializedAt !== undefined) updateFields.recipientPrivateInitializedAt = updates.recipientPrivateInitializedAt;
    if (updates.lastPaidAt !== undefined) updateFields.lastPaidAt = updates.lastPaidAt;
    if (typeof updates.totalPaid === 'number') updateFields.totalPaid = updates.totalPaid;
    await this.streams().updateOne({ employerWallet: employerWallet.trim(), id: streamId }, { $set: updateFields });
    return { ...stream, ...updateFields };
  }
}
