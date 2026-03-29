import { writeFile } from "node:fs/promises";

import { config } from "../config";
import { CandidateRepository } from "../repositories/candidate-repository";
import {
  ATSReview,
  AddonResult,
  CandidateMasterProfile,
  GeneratedCV,
  RecruiterReview,
  ReviewAgreement,
  WorkflowRunInput,
  WorkflowRunResult
} from "../types";
import { AgentsService } from "./agents";
import { JobOfferNormalizer } from "./job-offer-normalizer";

export class WorkflowService {
  constructor(
    private readonly candidateRepository: CandidateRepository,
    private readonly jobOfferNormalizer: JobOfferNormalizer,
    private readonly agentsService: AgentsService
  ) {}

  async normalizeJobOffer(input: WorkflowRunInput["jobOfferRaw"]) {
    return this.jobOfferNormalizer.normalize(input);
  }

  async resolveCandidate(
    input: WorkflowRunInput
  ): Promise<CandidateMasterProfile> {
    if (input.candidateMasterProfile) {
      return input.candidateMasterProfile;
    }

    if (!input.candidateId) {
      throw new Error("candidateId or candidateMasterProfile is required");
    }

    return this.candidateRepository.getById(input.candidateId);
  }

  async run(input: WorkflowRunInput): Promise<WorkflowRunResult> {
    const candidateMasterProfile = await this.resolveCandidate(input);
    const jobOffer = await this.normalizeJobOffer(input.jobOfferRaw);

    let previousAtsReview: ATSReview | undefined;
    let previousRecruiterReview: RecruiterReview | undefined;
    let latestGeneratedCv: GeneratedCV | undefined;
    let latestAtsReview: ATSReview | undefined;
    let latestRecruiterReview: RecruiterReview | undefined;
    let latestAddonResult: AddonResult | undefined;
    let reviewAgreement: ReviewAgreement | undefined;
    let finalStatus: WorkflowRunResult["status"] = "REJECTED_FOR_REVIEW";
    let iterationCount = 0;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const candidateResult = await this.agentsService.runCandidateAgent({
        jobOffer,
        candidateMasterProfile,
        generationRules: {
          language: "fr",
          max_pages: candidateMasterProfile.constraints.max_cv_pages,
          tone: "professional",
          truthfulness_mode: "strict"
        },
        revisionContext: {
          previous_ats_review: previousAtsReview,
          previous_recruiter_review: previousRecruiterReview
        }
      });

      latestGeneratedCv = candidateResult.generated_cv;
      iterationCount = attempt;

      const [atsResult, recruiterResult] = await Promise.all([
        this.agentsService.runAtsAgent({
          jobOffer,
          generatedCv: latestGeneratedCv
        }),
        this.agentsService.runRecruiterAgent({
          jobOffer,
          generatedCv: latestGeneratedCv
        })
      ]);

      latestAtsReview = atsResult.ats_review;
      latestRecruiterReview = recruiterResult.recruiter_review;

      const accepted =
        atsResult.decision.status === "pass" &&
        recruiterResult.decision.status === "pass";

      finalStatus = accepted ? "FINAL_APPROVED" : "REJECTED_FOR_REVIEW";
      reviewAgreement = {
        job_id: jobOffer.job_id,
        cv_id: latestGeneratedCv.cv_id,
        cv_generation_ok: true,
        ats_ok: atsResult.decision.status === "pass",
        recruiter_ok: recruiterResult.decision.status === "pass",
        review_agreement_ok: accepted,
        final_status: finalStatus,
        rejection_reasons: accepted
          ? []
          : [
              ...atsResult.decision.blocking_issues,
              ...recruiterResult.decision.blocking_issues
            ],
        iteration_count: attempt
      };
      latestAddonResult = this.agentsService.buildAddonResult(
        jobOffer,
        latestGeneratedCv,
        latestAtsReview,
        latestRecruiterReview,
        accepted
      );

      if (accepted) {
        break;
      }

      previousAtsReview = latestAtsReview;
      previousRecruiterReview = latestRecruiterReview;
    }

    if (
      !latestGeneratedCv ||
      !latestAtsReview ||
      !latestRecruiterReview ||
      !reviewAgreement ||
      !latestAddonResult
    ) {
      throw new Error("Workflow failed before producing a result");
    }

    const result: WorkflowRunResult = {
      status: finalStatus,
      job_offer: jobOffer,
      generated_cv: latestGeneratedCv,
      ats_review: latestAtsReview,
      recruiter_review: latestRecruiterReview,
      review_agreement: reviewAgreement,
      addon_result: latestAddonResult,
      iterations: iterationCount
    };

    void this.persistResult(result);

    return result;
  }

  private async persistResult(result: WorkflowRunResult): Promise<void> {
    try {
      const formattedJson = JSON.stringify(result, null, 2) + "\n";
      await writeFile(config.generatedResultPath, formattedJson, "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn(
        `Unable to write generated result to ${config.generatedResultPath}: ${message}`
      );
    }
  }
}
