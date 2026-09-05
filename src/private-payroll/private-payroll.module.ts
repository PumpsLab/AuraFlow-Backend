import { Module } from '@nestjs/common';
import { PrivatePayrollController } from './private-payroll.controller';
import { PrivatePayrollService } from './private-payroll.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CompaniesModule } from '../companies/companies.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [BlockchainModule, CompaniesModule, DatabaseModule],
  controllers: [PrivatePayrollController],
  providers: [PrivatePayrollService],
})
export class PrivatePayrollModule {}