import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HistoryService {
  constructor(private readonly db: DatabaseService) {}

  async getHistory(wallet: string, scope?: string) {
    const runs = await this.db.collection('payroll_runs').find({ wallet }).sort({ date: -1 }).toArray();
    const setupActions = await this.db.collection('setup_actions').find({ wallet }).sort({ date: -1 }).toArray();
    const claimRecords = await this.db.collection('claim_records').find({ wallet }).sort({ date: -1 }).toArray();
    return { payrollRuns: runs, setupActions, claimRecords };
  }

  async saveRecord(input: { wallet: string; kind: string; data: any }) {
    const ts = new Date().toISOString();
    const collection = input.kind === 'payroll-run' ? 'payroll_runs' : input.kind === 'setup-action' ? 'setup_actions' : 'claim_records';
    const record = { id: randomUUID(), date: ts, wallet: input.wallet, ...input.data, createdAt: ts };
    await this.db.collection(collection).insertOne(record);
    return record;
  }

  async clearHistory(wallet: string) {
    await this.db.collection('payroll_runs').deleteMany({ wallet });
    await this.db.collection('setup_actions').deleteMany({ wallet });
    await this.db.collection('claim_records').deleteMany({ wallet });
    return { cleared: true };
  }
}
