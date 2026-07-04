import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';

// @Global so every feature module can inject DbService without re-importing it.
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DatabaseModule {}
