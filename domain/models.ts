export type ID = string;
export type ISODateString = string;
export type CurrencyCode = "USD" | "USDC" | "EUR" | "TOKEN" | string;

export type SurveyStatus = "active" | "draft" | "results";
export type RequirementType = "Age" | "Location" | "Education level" | "";
export type QuestionType = "single_choice" | "multiple_choice";
export type SortKey = "rewardDesc" | "rewardAsc" | "nameAsc";
export type SurveyListVariant =
  | "explore"
  | "available"
  | "created"
  | "participated"
  | "active"
  | "history";
export type RewardStatus =
  | "not_applicable"
  | "eligible"
  | "pending"
  | "paid"
  | "unpaid"
  | "cap_reached"
  | "failed";
export type EligibilityDecision =
  | "qualify"
  | "not_qualified"
  | "unknown"
  | "already_voted"
  | "verification_required";
export type CreatorAction =
  | 'manage'
  | 'edit'
  | 'publish'
  | 'pause'
  | 'resume'
  | 'end'
  | 'share'
  | 'export_csv'
  | 'view_results';

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface SurveyCategory {
  id: ID;
  label: string;
}

export interface SurveyTag {
  id: ID;
  label: string;
}

export interface SurveyRequirement {
  id: ID;
  type: RequirementType;
  value: string;
}

export interface SurveyQuestionOption {
  id: ID;
  label: string;
  value?: string;
  order: number;
}

export interface SurveyQuestion {
  id: ID;
  order: number;
  type: QuestionType;
  title: string;
  options?: SurveyQuestionOption[];
  isRequired: boolean;
}

export interface SurveyBudget {
  rewardPerVoter?: Money;
  paidCap?: number;
  remainingBudget?: Money;
}

export interface SurveyProgress {
  responseCount?: number;
  paidResponseCount?: number;
  targetResponses?: number;
  paidCap?: number;
  paidSlotsLeft?: number;
  progressPercent?: number;
}

export interface SurveyTimeInfo {
  opensAt?: ISODateString;
  closesAt?: ISODateString;
  closedAt?: ISODateString;
  isOpen?: boolean;
  daysRemaining?: number;
  displayLabel?: string;
}

export interface EligibilityCheckResult {
  decision: EligibilityDecision;
  matchedRequirements: ID[];
  failedRequirements: ID[];
  message?: string;
  checkedAt?: ISODateString;
}

export interface SurveySummary {
  id: ID;
  title: string;
  description: string;
  status: SurveyStatus;
  categories: SurveyCategory[];
  tags?: SurveyTag[];
  budget?: SurveyBudget;
  progress?: SurveyProgress;
  eligibility?: EligibilityCheckResult;
  estimatedMinutes?: number;
  timeInfo?: SurveyTimeInfo;
  requirements?: SurveyRequirement[];
}

export interface SurveyCardData extends SurveySummary {
  listVariant: SurveyListVariant;
  primaryActionLabel?: string;
  primaryAction?: "vote" | "continue" | "details";
  questions?: SurveyQuestion[];
}

export interface SurveyDetail extends SurveySummary {
  questions?: SurveyQuestion[];
  canParticipate?: boolean;
  hasVoted?: boolean;
  rewardStatus?: RewardStatus;
  voterMessage?: string;
}

export interface SurveyManageDetail extends SurveyDetail {
  recentResponses?: CreatorRecentResponse[];
  allowedActions?: CreatorAction[];
}

export interface SurveyDraft {
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  tags: string[];
  category: string;
  questions: SurveyQuestion[];
  requirements: SurveyRequirement[];
  rewardPerVoter: number | null;
  voterCap: number | null;
  anonymity: boolean | null;
}

export interface CreatedSurveyCardData {
  id: string;
  title: string;
  category: string;
  status: SurveyStatus;
  rewardPerVoter?: number;
  endsAt?: string | null;
  responsesCurrent?: number;
  responsesTarget?: number;
  spent?: number;
  budget?: number;
  totalSpent?: number;
}

export interface ParticipatedSurveySummary {
  id: string;
  title: string;
  category: string;
  votedAt: ISODateString;
  rewardStatus: RewardStatus;
  reward?: Money;
}

export interface CreatorRecentResponse {
  id: ID;
  pseudonym: string;
  respondedAt: ISODateString;
  rewardStatus: RewardStatus;
  reward?: Money;
}

export interface HomeDashboardData {
  activeSurvey?: SurveySummary;
  recentlyParticipated?: ParticipatedSurveySummary[];
  availableForYou?: SurveyCardData[];
}
