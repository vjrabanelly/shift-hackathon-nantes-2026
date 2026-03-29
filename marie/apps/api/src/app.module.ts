import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysesModule } from './modules/analyses/analyses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AnalysesModule,
  ],
})
export class AppModule {}
