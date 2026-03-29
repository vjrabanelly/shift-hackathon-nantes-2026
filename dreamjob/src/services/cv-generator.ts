import { randomUUID } from "node:crypto";
import type { Profile } from "../schemas/profile.js";
import type { JobPost } from "../schemas/job-post.js";
import type { GeneratedCV } from "../schemas/generated-cv.js";
import type { ATSReview } from "../schemas/ats-review.js";
import type { RecruiterReview } from "../schemas/recruiter-review.js";
import type { ReviewAgreement } from "../schemas/review-agreement.js";
import type { AddonResult } from "../schemas/addon-result.js";
import { readCollection, writeCollection } from "./store.js";
import {
  CVS_PATH,
  ATS_REVIEWS_PATH,
  RECRUITER_REVIEWS_PATH,
  REVIEW_AGREEMENTS_PATH,
} from "./paths.js";
import { generateTargetedCV } from "./ai/candidate-agent.js";
import { reviewCVAsATS } from "./ai/ats-agent.js";
import { reviewCVAsRecruiter } from "./ai/recruiter-agent.js";

export interface OrchestratorResult {
  cv: GeneratedCV;
  atsReview: ATSReview;
  recruiterReview: RecruiterReview;
  reviewAgreement: ReviewAgreement;
  addonResult: AddonResult;
}

export interface DecisionInput {
  cvProduced: boolean;
  atsReview: ATSReview;
  recruiterReview: RecruiterReview;
}

export interface DecisionResult {
  cvGenerationOk: boolean;
  atsOk: boolean;
  recruiterOk: boolean;
  reviewAgreementOk: boolean;
  finalStatus: "FINAL_APPROVED" | "REJECTED" | "NEEDS_REVISION";
  rejectionReasons: string[];
}

export function evaluateDecision(input: DecisionInput): DecisionResult {
  const cvGenerationOk = input.cvProduced;
  const atsOk = input.atsReview.passed;
  const recruiterOk = input.recruiterReview.passed;
  const reviewAgreementOk = cvGenerationOk && atsOk && recruiterOk;

  const rejectionReasons: string[] = [];
  if (!cvGenerationOk) {
    rejectionReasons.push("CV generation failed.");
  }
  if (!atsOk) {
    rejectionReasons.push(
      `ATS review failed (score: ${input.atsReview.score}). ${input.atsReview.recommendations.join("; ")}`,
    );
  }
  if (!recruiterOk) {
    rejectionReasons.push(
      `Recruiter review failed (score: ${input.recruiterReview.score}). ${input.recruiterReview.recommendations.join("; ")}`,
    );
  }

  let finalStatus: "FINAL_APPROVED" | "REJECTED" | "NEEDS_REVISION";
  if (reviewAgreementOk) {
    finalStatus = "FINAL_APPROVED";
  } else if (!cvGenerationOk) {
    finalStatus = "REJECTED";
  } else {
    finalStatus = "NEEDS_REVISION";
  }

  return {
    cvGenerationOk,
    atsOk,
    recruiterOk,
    reviewAgreementOk,
    finalStatus,
    rejectionReasons,
  };
}

export function buildAddonResult(
  cv: GeneratedCV,
  atsReview: ATSReview,
  recruiterReview: RecruiterReview,
  reviewAgreement: ReviewAgreement,
): AddonResult {
  const status: "accepted" | "rejected" =
    reviewAgreement.finalStatus === "FINAL_APPROVED" ? "accepted" : "rejected";

  const atsScore = atsReview.score;
  const recruiterScore = recruiterReview.score;
  const overallScore = Math.round((atsScore + recruiterScore) / 2);

  const strengths: string[] = [
    ...atsReview.matchedKeywords.map((k) => `Matched keyword: ${k}`),
    ...recruiterReview.strengths,
  ];

  const weaknesses: string[] = [
    ...atsReview.missingKeywords.map((k) => `Missing keyword: ${k}`),
    ...atsReview.formatFlags,
    ...recruiterReview.concerns,
  ];

  const recommendations: string[] = [
    ...atsReview.recommendations,
    ...recruiterReview.recommendations,
  ];

  return {
    status,
    overall_score: overallScore,
    scores: { ats_score: atsScore, recruiter_score: recruiterScore },
    strengths,
    weaknesses,
    recommendations,
    rejection_reasons: reviewAgreement.rejectionReasons,
    cv_id: cv.id,
    job_post_id: reviewAgreement.jobPostId,
    iteration_count: reviewAgreement.iterationCount,
  };
}
// iterationCount starts at 1 + MAX_REVISION_ITERATIONS = 2
const MAX_REVISION_ITERATIONS = 1;

export async function orchestrate(
  profile: Profile,
  jobPost: JobPost,
  language: string,
): Promise<OrchestratorResult> {
  const rules = { language, truthfulnessMode: "strict" as const };

  // Initial generation
  let cv = await generateTargetedCV(profile, jobPost, rules);
  let atsReview = await reviewCVAsATS(jobPost, cv);
  let recruiterReview = await reviewCVAsRecruiter(jobPost, cv);
  let decision = evaluateDecision({
    cvProduced: true,
    atsReview,
    recruiterReview,
  });
  let iterationCount = 1;

  // Revision loop: retry with feedback when ATS or Recruiter fails
  while (
    decision.finalStatus === "NEEDS_REVISION" &&
    iterationCount < MAX_REVISION_ITERATIONS + 1
  ) {
    const revisionContext: import("./ai/candidate-agent.js").RevisionContext =
      {};
    if (!decision.atsOk) {
      revisionContext.previousAtsReview = atsReview;
    }
    if (!decision.recruiterOk) {
      revisionContext.previousRecruiterReview = recruiterReview;
    }

    cv = await generateTargetedCV(profile, jobPost, rules, revisionContext);
    atsReview = await reviewCVAsATS(jobPost, cv);
    recruiterReview = await reviewCVAsRecruiter(jobPost, cv);
    decision = evaluateDecision({
      cvProduced: true,
      atsReview,
      recruiterReview,
    });
    iterationCount++;
  }

  // After max iterations, if still not approved, mark as REJECTED
  if (decision.finalStatus === "NEEDS_REVISION") {
    decision.finalStatus = "REJECTED";
    decision.reviewAgreementOk = false;
  }

  const reviewAgreement: ReviewAgreement = {
    id: `ra_${randomUUID().slice(0, 8)}`,
    jobPostId: jobPost.id,
    cvId: cv.id,
    ...decision,
    iterationCount,
  };

  // Store all artifacts
  const cvs = await readCollection<GeneratedCV>(CVS_PATH);
  cvs.push(cv);
  await writeCollection(CVS_PATH, cvs);

  const atsReviews = await readCollection<ATSReview>(ATS_REVIEWS_PATH);
  atsReviews.push(atsReview);
  await writeCollection(ATS_REVIEWS_PATH, atsReviews);

  const recruiterReviews = await readCollection<RecruiterReview>(
    RECRUITER_REVIEWS_PATH,
  );
  recruiterReviews.push(recruiterReview);
  await writeCollection(RECRUITER_REVIEWS_PATH, recruiterReviews);

  const agreements = await readCollection<ReviewAgreement>(
    REVIEW_AGREEMENTS_PATH,
  );
  agreements.push(reviewAgreement);
  await writeCollection(REVIEW_AGREEMENTS_PATH, agreements);

  const addonResult = buildAddonResult(
    cv,
    atsReview,
    recruiterReview,
    reviewAgreement,
  );

  return { cv, atsReview, recruiterReview, reviewAgreement, addonResult };
}
