import { Module } from '@nestjs/common';
import { MockAnalysisProvider } from './mock-analysis-provider.service';
import { ClaudeAnalysisProvider } from './claude-analysis-provider.service';
import { OpenAiAnalysisProvider } from './openai-analysis-provider.service';
import { ANALYSIS_PROVIDER } from './analysis-provider.interface';

@Module({
  providers: [
    {
      provide: ANALYSIS_PROVIDER,
      // useFactory : s'exécute APRÈS que ConfigModule a chargé le .env
      // (useClass: selectProvider() s'exécute à l'import, avant dotenv)
      useFactory: () => {
        if (process.env.OPENAI_API_KEY) return new OpenAiAnalysisProvider();
        if (process.env.ANTHROPIC_API_KEY) return new ClaudeAnalysisProvider();
        return new MockAnalysisProvider();
      },
    },
  ],
  exports: [ANALYSIS_PROVIDER],
})
export class ProviderModule {}
