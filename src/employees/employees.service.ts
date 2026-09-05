import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { normalizePayrollMode, type PayrollMode } from '../common/payroll-mode';

export type EmployeeRecord = {
  id: string; employerWallet: string; wallet: string; name: string;
  payrollMode?: PayrollMode; notes?: string; department?: string; role?: string;
  employmentType?: string; paySchedule?: string; compensationUnit?: string;
  compensationAmountUsd?: number; weeklyHours?: number; monthlySalaryUsd?: number;
  startDate?: string | null; privateRecipientInitializedAt?: string | null;
  privateRecipientInitStatus?: string; privateRecipientInitRequestedAt?: string | null;
  privateRecipientInitLastAttemptAt?: string | null; privateRecipientInitConfirmedAt?: string | null;
  privateRecipientInitTxSignature?: string | null; privateRecipientInitError?: string | null;
  createdAt: string; updatedAt: string;
};

@Injectable()
export class EmployeesService {
  constructor(private readonly db: DatabaseService) {}
  private employees() { return this.db.collection('employees'); }
  private streams() { return this.db.collection('streams'); }

  async listByEmployer(employerWallet: string) {
    return this.employees().find({ employerWallet: employerWallet.trim() }).sort({ createdAt: 1 }).toArray();
  }

  async listByWallet(wallet: string) {
    return this.employees().find({ wallet: wallet.trim() }).sort({ createdAt: 1 }).toArray();
  }

  async findById(employerWallet: string, employeeId: string) {
    return this.employees().findOne({ employerWallet: employerWallet.trim(), id: employeeId });
  }

  async create(input: { employerWallet: string; wallet: string; name: string; payrollMode?: PayrollMode; notes?: string; department?: string; role?: string; compensationAmountUsd?: number; monthlySalaryUsd?: number; startDate?: string | null }) {
    const wallet = input.wallet.trim();
    const name = input.name.trim();
    if (!name) throw new Error('Employee name is required');

    const timestamp = new Date().toISOString();
    const employee: EmployeeRecord = {
      id: randomUUID(), employerWallet: input.employerWallet.trim(), wallet, name,
      payrollMode: normalizePayrollMode(input.payrollMode),
      notes: input.notes?.trim() || undefined, department: input.department?.trim() || undefined,
      role: input.role?.trim() || undefined, employmentType: 'full_time', paySchedule: 'monthly',
      compensationUnit: 'monthly', compensationAmountUsd: input.compensationAmountUsd,
      monthlySalaryUsd: input.monthlySalaryUsd,
      startDate: input.startDate?.trim() ? new Date(input.startDate).toISOString() : null,
      privateRecipientInitializedAt: null, privateRecipientInitStatus: 'pending',
      privateRecipientInitRequestedAt: timestamp, privateRecipientInitLastAttemptAt: null,
      privateRecipientInitConfirmedAt: null, privateRecipientInitTxSignature: null,
      privateRecipientInitError: null, createdAt: timestamp, updatedAt: timestamp,
    };

    const duplicate = await this.employees().findOne({ employerWallet: input.employerWallet.trim(), wallet });
    if (duplicate) throw new Error('Employee already exists for this employer');
    await this.employees().insertOne(employee);
    return employee;
  }

  async update(employerWallet: string, employeeId: string, updates: Partial<EmployeeRecord>) {
    const timestamp = new Date().toISOString();
    const { id: _id, employerWallet: _ew, wallet: _w, createdAt: _c, updatedAt: _u, ...allowed } = updates;
    const result = await this.employees().findOneAndUpdate(
      { employerWallet: employerWallet.trim(), id: employeeId },
      { $set: { ...allowed, updatedAt: timestamp } },
      { returnDocument: 'after' },
    );
    if (!result) throw new Error('Employee not found');
    return result;
  }

  async markPrivateRecipientInitialized(employeeWallet: string, initializedAt?: string, txSignature?: string | null) {
    const ts = initializedAt || new Date().toISOString();
    const employees = await this.listByWallet(employeeWallet);
    if (employees.length === 0) throw new Error('Employee not found');
    await this.employees().updateMany({ wallet: employeeWallet }, { $set: { privateRecipientInitializedAt: ts, privateRecipientInitStatus: 'confirmed', privateRecipientInitLastAttemptAt: ts, privateRecipientInitConfirmedAt: ts, privateRecipientInitTxSignature: txSignature ?? null, privateRecipientInitError: null, updatedAt: ts } });
    for (const emp of employees) {
      await this.streams().updateMany({ employerWallet: emp.employerWallet, employeeId: emp.id }, { $set: { recipientPrivateInitializedAt: ts, updatedAt: ts } });
    }
    return { employeeWallet, initializedAt: ts, employersUpdated: employees.length };
  }

  async sponsorInitializeVault(employeeWallet: string, employerWallet: string): Promise<boolean> {
    const employees = await this.listByWallet(employeeWallet);
    const owned = employees.find(e => e.employerWallet === employerWallet);
    if (!owned) return false;
    if (owned.privateRecipientInitStatus === 'confirmed') return true;
    await this.employees().updateOne({ id: owned.id, employerWallet }, { $set: { privateRecipientInitStatus: 'confirmed', privateRecipientInitConfirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    return true;
  }
}
