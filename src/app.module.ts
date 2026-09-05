import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { StreamsModule } from './streams/streams.module';
import { PayrollModule } from './payroll/payroll.module';
import { PayrollRunsModule } from './payroll-runs/payroll-runs.module';
import { ClaimsModule } from './claims/claims.module';
import { TreasuryModule } from './treasury/treasury.module';
import { PrivatePayrollModule } from './private-payroll/private-payroll.module';
import { AuditModule } from './audit/audit.module';
import { ComplianceModule } from './compliance/compliance.module';
import { HistoryModule } from './history/history.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    EmployeesModule,
    StreamsModule,
    PayrollModule,
    PayrollRunsModule,
    ClaimsModule,
    TreasuryModule,
    PrivatePayrollModule,
    AuditModule,
    ComplianceModule,
    HistoryModule,
    BlockchainModule,
  ],
})
export class AppModule {}
