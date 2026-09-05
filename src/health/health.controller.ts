import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Health liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive', schema: { example: { status: 'ok', timestamp: '2025-01-01T00:00:00.000Z', uptime: 12345 } } })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Health readiness check (includes database connectivity)' })
  @ApiResponse({ status: 200, description: 'Service is ready and database is connected', schema: { example: { status: 'ok', db: 'connected', timestamp: '2025-01-01T00:00:00.000Z', uptime: 12345 } } })
  @ApiResponse({ status: 503, description: 'Service unavailable - database disconnected' })
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
