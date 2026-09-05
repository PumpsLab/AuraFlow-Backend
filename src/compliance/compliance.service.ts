import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ComplianceService {
  constructor(private readonly db: DatabaseService) {}
  private events() { return this.db.collection('compliance_events'); }

  async saveEvent(input: { actorWallet: string; action: string; route: string; subjectWallet?: string; resourceType?: string; resourceId?: string; status?: string; metadata?: any }) {
    const ts = new Date().toISOString();
    const event = { id: randomUUID(), date: ts, ...input, createdAt: ts };
    await this.events().insertOne(event);
    return event;
  }

  async listEvents(wallet: string, limit = 25) {
    return this.events().find({ $or: [{ actorWallet: wallet }, { subjectWallet: wallet }] }).sort({ date: -1 }).limit(Math.min(Math.max(1, limit), 100)).toArray();
  }

  async exportData(wallet: string, scope: string) {
    const runs = await this.db.collection('payroll_runs').find({ wallet }).sort({ date: -1 }).toArray();
    const setupActions = await this.db.collection('setup_actions').find({ wallet }).sort({ date: -1 }).toArray();
    const claimRecords = await this.db.collection('claim_records').find({ wallet }).sort({ date: -1 }).toArray();
    const events = await this.events().find({ $or: [{ actorWallet: wallet }, { subjectWallet: wallet }] }).sort({ date: -1 }).toArray();
    const bundle = { wallet, scope, payrollRuns: runs, setupActions, claimRecords, complianceEvents: events, exportedAt: new Date().toISOString() };
    const integrityHash = createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
    await this.saveEvent({ actorWallet: wallet, action: 'compliance.export', route: '/compliance/export', resourceType: 'compliance-export', status: 'success', metadata: { scope, integrityHash } });
    return { ...bundle, integrityHash };
  }
}
