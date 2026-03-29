import { Injectable } from '@nestjs/common';
import {
  AnalysisStatus, InputType,
  type Analysis, type AnalysisResult,
} from '@marie/shared';

@Injectable()
export class InMemoryStore {
  private readonly records = new Map<string, Analysis>();

  create(id: string, inputType: InputType): Analysis {
    const record: Analysis = {
      id,
      status: AnalysisStatus.Pending,
      inputType,
      rawContent: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
    };
    this.records.set(id, record);
    return record;
  }

  findOne(id: string): Analysis | undefined {
    return this.records.get(id);
  }

  updateStatus(id: string, status: AnalysisStatus): void {
    const rec = this.records.get(id);
    if (rec) rec.status = status;
  }

  updateResult(id: string, result: AnalysisResult): void {
    const rec = this.records.get(id);
    if (rec) {
      rec.result = result;
      rec.status = AnalysisStatus.Completed;
      rec.completedAt = new Date().toISOString();
    }
  }

  setFailed(id: string): void {
    const rec = this.records.get(id);
    if (rec) rec.status = AnalysisStatus.Failed;
  }
}
