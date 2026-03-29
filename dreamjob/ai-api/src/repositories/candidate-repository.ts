import { readFile } from "node:fs/promises";

import { config } from "../config";
import { CandidateFileStore, CandidateMasterProfile } from "../types";

export class CandidateRepository {
  async getById(candidateId: string): Promise<CandidateMasterProfile> {
    const raw = await readFile(config.dataPath, "utf8");
    const store = JSON.parse(raw) as CandidateFileStore;
    const candidate = store.candidates.find(
      (entry) => entry.candidate_id === candidateId
    );

    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    return candidate;
  }
}
