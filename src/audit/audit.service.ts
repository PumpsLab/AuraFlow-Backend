import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async getAuditData(token: string) {
    const auditorToken = await this.db.collection('auditor_tokens').findOne({ token, revoked: { $ne: true } });
    if (!auditorToken) throw new Error('Invalid auditor token');
    if (new Date(auditorToken.expiresAt) < new Date()) throw new Error('Token expired');
    const runs = await this.db.collection('payroll_runs').find({ wallet: auditorToken.employerWallet }).sort({ date: -1 }).toArray();
    const setupActions = await this.db.collection('setup_actions').find({ wallet: auditorToken.employerWallet }).sort({ date: -1 }).toArray();
    const claimRecords = await this.db.collection('claim_records').find({ wallet: auditorToken.employerWallet }).sort({ date: -1 }).toArray();
    return { employerWallet: auditorToken.employerWallet, payrollRuns: runs, setupActions, claimRecords };
  }

  async listTokens(employerWallet: string) { return this.db.collection('auditor_tokens').find({ employerWallet }).sort({ createdAt: 1 }).toArray(); }

  async createToken(employerWallet: string, label?: string) {
    const ts = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const record = { id: randomUUID(), token: `exp_${randomUUID().replace(/-/g, '')}`, employerWallet, label, expiresAt, revoked: false, createdAt: ts, updatedAt: ts };
    await this.db.collection('auditor_tokens').insertOne(record);
    return record;
  }

  async revokeToken(id: string) {
    const ts = new Date().toISOString();
    await this.db.collection('auditor_tokens').updateOne({ id }, { $set: { revoked: true, revokedAt: ts, updatedAt: ts } });
  }

  async validateToken(token: string) {
    const record = await this.db.collection('auditor_tokens').findOne({ token, revoked: { $ne: true } });
    if (!record) throw new Error('Invalid token');
    if (new Date(record.expiresAt) < new Date()) throw new Error('Token expired');
    return { employerWallet: record.employerWallet, label: record.label };
  }
}
