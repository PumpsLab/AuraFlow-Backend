import { Module } from '@nestjs/common';
import { PayrollRunsController } from './payroll-runs.controller';
import { PayrollRunsService } from './payroll-runs.service';

@Module({
  controllers: [PayrollRunsController],
  providers: [PayrollRunsService],
})
export class PayrollRunsModule {}
