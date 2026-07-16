import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

// Register default metrics collected from Node.js process
collectDefaultMetrics();

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
