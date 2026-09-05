export type PayrollMode = 'streaming' | 'manual';

export function normalizePayrollMode(mode?: PayrollMode | string): PayrollMode {
  if (mode === 'manual') return 'manual';
  return 'streaming';
}

export const PAYROLL_MODE_LABELS: Record<PayrollMode, string> = {
  streaming: 'Streaming',
  manual: 'Manual',
};
