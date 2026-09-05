import { Controller, Get, Post, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { TreasuryService } from './treasury.service';

@ApiTags('Treasury')
@Controller()
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}
}
