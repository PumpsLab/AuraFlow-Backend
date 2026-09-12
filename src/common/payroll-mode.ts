export type PayrollMode = 'streaming' | 'private_payroll';

export function normalizePayrollMode(mode?: PayrollMode | string): PayrollMode {
  if (mode === 'private_payroll' || mode === 'manual') return 'private_payroll';
  return 'streaming';
}

export const PAYROLL_MODE_LABELS: Record<PayrollMode, string> = {
  streaming: 'Streaming',
  private_payroll: 'Private Payroll',
};
