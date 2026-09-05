import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.db.getDb().command({ ping: 1 });
      return {
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch {
      throw new HttpException(
        { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
