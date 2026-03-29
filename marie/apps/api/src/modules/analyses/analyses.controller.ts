import {
  Controller, Post, Get, Param, Body, Sse,
  UploadedFile, UseInterceptors,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { map, Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { InputType } from '@marie/shared';
import { InMemoryStore } from './in-memory.store';
import { CreateTextAnalysisDto } from './dto/create-text-analysis.dto';
import { StreamingService } from '../streaming/streaming.service';
import { AnalysisOrchestrator } from '../../orchestrator/analysis.orchestrator';

@Controller('api/analyses')
export class AnalysesController {
  constructor(
    private readonly store: InMemoryStore,
    private readonly streaming: StreamingService,
    private readonly orchestrator: AnalysisOrchestrator,
  ) {}

  @Post('text')
  analyzeText(@Body() dto: CreateTextAnalysisDto) {
    const id = uuidv4();
    this.store.create(id, InputType.Text);
    this.streaming.createStream(id);
    void this.orchestrator.runTextAnalysis(id, dto.content);
    return { id };
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  analyzeImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image.');
    }
    const id = uuidv4();
    this.store.create(id, InputType.Image);
    this.streaming.createStream(id);
    void this.orchestrator.runImageAnalysis(id, file.buffer, file.mimetype);
    return { id };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const analysis = this.store.findOne(id);
    if (!analysis) throw new NotFoundException(`Analyse ${id} introuvable.`);
    return analysis;
  }

  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    // Stream en cours ou terminé récemment (ReplaySubject rejoue les events)
    const obs = this.streaming.getStream(id);
    if (obs) {
      return obs.pipe(
        map((event) => ({ type: event.event, data: JSON.stringify(event) } as MessageEvent)),
      );
    }

    // Analyse terminée depuis plus de 60s : renvoie le résultat stocké comme event unique
    const analysis = this.store.findOne(id);
    if (!analysis) throw new NotFoundException(`Analyse ${id} introuvable.`);

    return new Observable<MessageEvent>((subscriber) => {
      if (analysis.result) {
        const completedEvent = { type: 'analysis.completed', data: JSON.stringify({ event: 'analysis.completed', analysisId: id, timestamp: analysis.completedAt, data: analysis.result }) } as MessageEvent;
        subscriber.next(completedEvent);
      }
      subscriber.complete();
    });
  }
}
