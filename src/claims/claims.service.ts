import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ClaimsService {
  constructor(private readonly db: DatabaseService) {}

  async getClaimBalance(employeeWallet: string) {
    const payrollRuns = await this.db.collection('payroll_runs').find({ employeeIds: { $in: [employeeWallet] } }).toArray();
    const claimRecords = await this.db.collection('claim_records').find({ wallet: employeeWallet }).toArray();
    let totalReceived = 0;
    for (const run of payrollRuns) {
      const idx = (run.employeeIds || []).indexOf(employeeWallet);
      if (idx >= 0 && run.employeeAmounts && run.employeeAmounts[idx]) totalReceived += run.employeeAmounts[idx];
    }
    const totalClaimed = claimRecords.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    return { employeeWallet, balance: Math.round((totalReceived - totalClaimed) * 1_000_000), syncedAt: new Date().toISOString() };
  }

  async listCashoutRequests(query: { employeeWallet?: string; employerWallet?: string; scope?: string }) {
    if (query.scope === 'employee' && query.employeeWallet) {
      return this.db.collection('cashout_requests').find({ employeeWallet: query.employeeWallet }).sort({ createdAt: -1 }).toArray();
    }
    if (query.scope === 'employer' && query.employerWallet) {
      return this.db.collection('cashout_requests').find({ employerWallet: query.employerWallet }).sort({ createdAt: -1 }).toArray();
    }
    return [];
  }

  async createCashoutRequest(input: any) {
    const ts = new Date().toISOString();
    const record = { id: randomUUID(), ...input, status: 'pending', createdAt: ts, updatedAt: ts };
    await this.db.collection('cashout_requests').insertOne(record);
    return record;
  }

  async resolveCashoutRequest(id: string, resolution: { status: string; resolvedByWallet?: string; resolutionNote?: string }) {
    const ts = new Date().toISOString();
    await this.db.collection('cashout_requests').updateOne({ id }, { $set: { status: resolution.status, resolvedAt: ts, resolvedByWallet: resolution.resolvedByWallet, resolutionNote: resolution.resolutionNote, updatedAt: ts } });
    return this.db.collection('cashout_requests').findOne({ id });
  }

  async processClaimSalary(input: { streamId: string; employeeWallet: string; amountMicro: number }) {
    const stream = await this.db.collection('streams').findOne({ id: input.streamId });
    if (!stream) throw new Error('Stream not found');
    return { streamId: input.streamId, status: 'processed', amountMicro: input.amountMicro };
  }

  async cancelClaimSalary(streamId: string) {
    return { streamId, status: 'cancelled' };
  }
}
