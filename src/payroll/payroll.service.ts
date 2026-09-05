import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PayrollService {
  constructor(private readonly db: DatabaseService) {}

  async getEmployeePayrollData(employeeWallet: string) {
    const employees = await this.db.collection('employees').find({ wallet: employeeWallet.trim() }).toArray();
    const employeeIds = employees.map((e: any) => e.id);
    const streams = await this.db.collection('streams').find({ employeeId: { $in: employeeIds } }).toArray();

    const enrichedStreams = streams.map((stream: any) => {
      const employee = employees.find((e: any) => e.id === stream.employeeId);
      if (!employee) return null;
      const nowMs = Date.now();
      const lastAccrualTs = stream.lastPaidAt ? new Date(stream.lastPaidAt).getTime() : (stream.startsAt ? new Date(stream.startsAt).getTime() : nowMs);
      const effectiveNowMs = Math.max(nowMs, lastAccrualTs);
      const accrued = Math.floor((effectiveNowMs - lastAccrualTs) / 1000 * stream.ratePerSecond * 1_000_000);
      return {
        employerWallet: stream.employerWallet,
        employee: { id: employee.id, wallet: employee.wallet, name: employee.name, privateRecipientInitializedAt: employee.privateRecipientInitializedAt },
        stream: { id: stream.id, status: stream.status, ratePerSecond: stream.ratePerSecond, payoutMode: stream.payoutMode ?? 'base', lastPaidAt: stream.lastPaidAt ?? null, totalPaid: stream.totalPaid ?? 0, updatedAt: stream.updatedAt },
        liveState: { ready: true },
        snapshot: { accruedUnpaidMicro: accrued.toString(), totalPaidPrivateMicro: Math.floor((stream.totalPaid ?? 0) * 1_000_000).toString() },
      };
    }).filter(Boolean);

    return { employeeWallet, employees: employees.map((e: any) => ({ id: e.id, employerWallet: e.employerWallet, name: e.name, payrollMode: e.payrollMode ?? 'streaming' })), streams: enrichedStreams, syncedAt: new Date().toISOString() };
  }

  async getStreamState(employerWallet: string, streamId: string) {
    const stream = await this.db.collection('streams').findOne({ employerWallet: employerWallet.trim(), id: streamId });
    if (!stream) throw new Error('Stream not found');
    const employee = await this.db.collection('employees').findOne({ employerWallet: employerWallet.trim(), id: stream.employeeId });
    if (!employee) throw new Error('Employee not found');
    const nowMs = Date.now();
    const lastAccrualTs = stream.lastPaidAt ? new Date(stream.lastPaidAt).getTime() : (stream.startsAt ? new Date(stream.startsAt).getTime() : nowMs);
    const effectiveNowMs = Math.max(nowMs, lastAccrualTs);
    const accrued = Math.floor((effectiveNowMs - lastAccrualTs) / 1000 * stream.ratePerSecond * 1_000_000);
    return {
      employerWallet, streamId,
      employee: { id: employee.id, wallet: employee.wallet, name: employee.name },
      stream: { id: stream.id, status: stream.status, ratePerSecond: stream.ratePerSecond, lastPaidAt: stream.lastPaidAt ?? null, totalPaid: stream.totalPaid ?? 0 },
      state: { accruedUnpaidMicro: accrued.toString(), totalPaidPrivateMicro: Math.floor((stream.totalPaid ?? 0) * 1_000_000).toString() },
      syncedAt: new Date().toISOString(),
    };
  }
}
