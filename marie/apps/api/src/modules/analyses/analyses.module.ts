import { Module } from '@nestjs/common';
import { AnalysesController } from './analyses.controller';
import { InMemoryStore } from './in-memory.store';
import { StreamingModule } from '../streaming/streaming.module';
import { ProviderModule } from '../provider/provider.module';
import { AnalysisOrchestrator } from '../../orchestrator/analysis.orchestrator';

@Module({
  imports: [StreamingModule, ProviderModule],
  controllers: [AnalysesController],
  providers: [InMemoryStore, AnalysisOrchestrator],
})
export class AnalysesModule {}
