import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

export type PayrollFrequency = 'monthly' | 'semi_monthly' | 'biweekly' | 'weekly';
export type PayrollProfileStatus = 'active' | 'inactive';
export type CycleStatus = 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed';
export type RunItemStatus = 'queued' | 'processing' | 'paid' | 'failed' | 'skipped';

export interface PayrollProfile {
  id: string; employerWallet: string; employeeId: string; currency?: string;
  baseSalaryMonthly: number; allowancesMonthly?: number; fixedDeductionsMonthly?: number;
  taxPercent?: number; joinDate: string; exitDate?: string | null; status: PayrollProfileStatus;
  createdAt: string; updatedAt: string;
}

export interface PayrollCycle {
  id: string; employerWallet: string; label: string; frequency: PayrollFrequency;
  periodStart: string; periodEnd: string; payDate: string; status: CycleStatus;
  createdByWallet: string; approvedByWallet?: string; approvedAt?: string; completedAt?: string;
  totals?: any; createdAt: string; updatedAt: string;
}

export interface PayrollCycleItem {
  id: string; employerWallet: string; cycleId: string; employeeId: string;
  employeeWallet: string; employeeName: string; currency: string; status: string;
  breakdown: { periodDays: number; activeDays: number; baseSalaryAmount: number; allowancesAmount: number; grossAmount: number; deductionsAmount: number; taxableAmount: number; taxWithheldAmount: number; netPayAmount: number };
  createdAt: string; updatedAt: string;
}

@Injectable()
export class PayrollRunsService {
  constructor(private readonly db: DatabaseService) {}
  private profiles() { return this.db.collection('payroll_profiles'); }
  private cycles() { return this.db.collection('payroll_cycles'); }
  private cycleItems() { return this.db.collection('payroll_cycle_items'); }

  async listProfiles(employerWallet: string) { return this.profiles().find({ employerWallet }).sort({ createdAt: 1 }).toArray(); }

  async upsertProfile(input: { employerWallet: string; employeeId: string; currency?: string; baseSalaryMonthly: number; allowancesMonthly?: number; fixedDeductionsMonthly?: number; taxPercent?: number; joinDate: string; exitDate?: string | null; status?: PayrollProfileStatus }) {
    const existing = await this.profiles().findOne({ employerWallet: input.employerWallet, employeeId: input.employeeId });
    const ts = new Date().toISOString();
    if (existing) {
      await this.profiles().updateOne({ id: existing.id }, { $set: { ...input, updatedAt: ts } });
      return { ...existing, ...input, updatedAt: ts };
    }
    const profile: PayrollProfile = { id: randomUUID(), ...input, status: input.status || 'active', createdAt: ts, updatedAt: ts };
    await this.profiles().insertOne(profile);
    return profile;
  }

  async listCycles(employerWallet: string) { return this.cycles().find({ employerWallet }).sort({ createdAt: 1 }).toArray(); }

  async getCycleById(employerWallet: string, cycleId: string) { return this.cycles().findOne({ employerWallet, id: cycleId }); }

  async createCycle(input: { employerWallet: string; createdByWallet: string; label: string; frequency: PayrollFrequency; periodStart: string; periodEnd: string; payDate: string }) {
    const ts = new Date().toISOString();
    const cycle: PayrollCycle = { id: randomUUID(), ...input, status: 'draft', createdAt: ts, updatedAt: ts };
    await this.cycles().insertOne(cycle);
    return cycle;
  }

  async listCycleItems(employerWallet: string, cycleId: string) { return this.cycleItems().find({ employerWallet, cycleId }).toArray(); }

  async computeCycle(employerWallet: string, cycleId: string) {
    const cycle = await this.getCycleById(employerWallet, cycleId);
    if (!cycle) throw new Error('Cycle not found');
    const profiles = await this.profiles().find({ employerWallet, status: 'active' }).toArray();
    const periodStart = new Date(cycle.periodStart).getTime();
    const periodEnd = new Date(cycle.periodEnd).getTime();
    const periodDays = Math.max(1, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)));
    const ts = new Date().toISOString();
    const items: PayrollCycleItem[] = [];
    for (const profile of profiles) {
      const joinMs = new Date(profile.joinDate).getTime();
      const exitMs = profile.exitDate ? new Date(profile.exitDate).getTime() : periodEnd;
      const activeStart = Math.max(periodStart, joinMs);
      const activeEnd = Math.min(periodEnd, exitMs);
      const activeDays = Math.max(0, Math.ceil((activeEnd - activeStart) / (1000 * 60 * 60 * 24)));
      if (activeDays <= 0) continue;
      const dailyBase = profile.baseSalaryMonthly / periodDays;
      const baseSalaryAmount = dailyBase * activeDays;
      const allowancesAmount = ((profile.allowancesMonthly || 0) / periodDays) * activeDays;
      const grossAmount = baseSalaryAmount + allowancesAmount;
      const deductionsAmount = profile.fixedDeductionsMonthly || 0;
      const taxableAmount = Math.max(0, grossAmount - deductionsAmount);
      const taxWithheldAmount = taxableAmount * ((profile.taxPercent || 0) / 100);
      const netPayAmount = taxableAmount - taxWithheldAmount;
      const employee = await this.db.collection('employees').findOne({ id: profile.employeeId, employerWallet });
      const item: PayrollCycleItem = {
        id: randomUUID(), employerWallet, cycleId, employeeId: profile.employeeId,
        employeeWallet: employee?.wallet || '', employeeName: employee?.name || '',
        currency: profile.currency || 'USDC', status: 'computed',
        breakdown: { periodDays, activeDays, baseSalaryAmount, allowancesAmount, grossAmount, deductionsAmount, taxableAmount, taxWithheldAmount, netPayAmount },
        createdAt: ts, updatedAt: ts,
      };
      await this.cycleItems().insertOne(item);
      items.push(item);
    }
    await this.cycles().updateOne({ id: cycleId }, { $set: { status: 'pending_approval', updatedAt: ts } });
    const totals = { employeeCount: items.length, netAmount: items.reduce((s, i) => s + i.breakdown.netPayAmount, 0) };
    return { items, totals };
  }

  async approveCycle(employerWallet: string, cycleId: string, approverWallet: string) {
    const ts = new Date().toISOString();
    await this.cycles().updateOne({ id: cycleId }, { $set: { status: 'approved', approvedByWallet: approverWallet, approvedAt: ts, updatedAt: ts } });
    await this.cycleItems().updateMany({ cycleId, employerWallet }, { $set: { status: 'approved', updatedAt: ts } });
    return this.getCycleById(employerWallet, cycleId);
  }

  async buildDisbursementPlan(employerWallet: string, cycleId: string) {
    const items = await this.cycleItems().find({ employerWallet, cycleId }).toArray();
    return { recipients: items.map(i => ({ employeeId: i.employeeId, employeeWallet: i.employeeWallet, employeeName: i.employeeName, netPayAmount: i.breakdown.netPayAmount })), summary: { recipientCount: items.length, totalAmount: items.reduce((s, i) => s + i.breakdown.netPayAmount, 0) } };
  }
}
