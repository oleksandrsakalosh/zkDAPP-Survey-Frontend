export type ID = string;
export type ISODateString = string;
export type WalletAddress = string;
export type CurrencyCode = 'USD' | 'USDC' | 'EUR' | 'TOKEN' | string;

/* ---------------------------------- */
/* enums / unions                     */
/* ---------------------------------- */

export type SurveyStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'ended'
  | 'completed'
  | 'archived';

export type SurveyVisibility = 'public' | 'unlisted' | 'private';

export type SurveyRole = 'creator' | 'voter' | 'admin';

export type RewardDistributionMode =
  | 'instant'
  | 'after_completion'
  | 'manual'
  | 'wallet_claim';

export type RewardStatus =
  | 'not_applicable'
  | 'eligible'
  | 'pending'
  | 'paid'
  | 'unpaid'
  | 'cap_reached'
  | 'failed';

export type EligibilityDecision =
  | 'qualify'
  | 'not_qualified'
  | 'unknown'
  | 'already_voted'
  | 'verification_required';

export type RequirementType =
  | 'age'
  | 'location'
  | 'country'
  | 'region'
  | 'education'
  | 'citizenship'
  | 'custom';

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'rating'
  | 'dropdown'
  | 'date';

export type VoteLifecycleStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'verifying'
  | 'verified'
  | 'recorded'
  | 'reward_pending'
  | 'reward_paid'
  | 'failed';

export type VerificationProvider = 'valera' | 'eudi' | 'wallet' | 'custom';

export type VerificationStepStatus = 'pending' | 'in_progress' | 'done' | 'failed';

export type SurveySortOption =
  | 'reward_desc'
  | 'reward_asc'
  | 'closing_soon'
  | 'newest'
  | 'responses_desc'
  | 'relevance';

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

export type SurveyListVariant =
  | 'explore'
  | 'available'
  | 'created'
  | 'participated'
  | 'active'
  | 'history';

/* ---------------------------------- */
/* primitives / reusable small shapes */
/* ---------------------------------- */

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface DateRange {
  startAt?: ISODateString;
  endAt?: ISODateString;
}

export interface SurveyTag {
  id: ID;
  label: string;
  kind?: 'category' | 'topic' | 'status' | 'metadata';
}

export interface SurveyCategory {
  id: ID;
  label: string;
  slug?: string;
}

export interface SurveyBadge {
  id: ID;
  label: string;
  tone:
    | 'neutral'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'primary';
}

export interface SurveyRequirement {
  id: ID;
  type: RequirementType;
  label: string;
  value: string;
  operator?: 'eq' | 'neq' | 'gte' | 'lte' | 'between' | 'in';
  isOptional?: boolean;
}

export interface EligibilityCheckResult {
  decision: EligibilityDecision;
  matchedRequirements: ID[];
  failedRequirements: ID[];
  message?: string;
  checkedAt?: ISODateString;
}

export interface SurveyBudget {
  rewardPerVoter?: Money;
  paidCap?: number;
  rewardPool?: Money;
  platformFee?: Money;
  totalCost?: Money;
  spentAmount?: Money;
  remainingBudget?: Money;
  distributionMode?: RewardDistributionMode;
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

export interface SurveyCardMeta {
  estimatedMinutes?: number;
  responseCount?: number;
  paidCap?: number;
  closesAt?: ISODateString;
  eligibility?: EligibilityDecision;
  hasVoted?: boolean;
}

/* ---------------------------------- */
/* question / answer / result models  */
/* ---------------------------------- */

export interface SurveyQuestionOption {
  id: ID;
  label: string;
  value?: string;
  order: number;
}

export interface SurveyQuestionValidation {
  required?: boolean;
  minSelections?: number;
  maxSelections?: number;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
}

export interface SurveyQuestion {
  id: ID;
  surveyId: ID;
  order: number;
  type: QuestionType;
  title: string;
  description?: string;
  placeholder?: string;
  options?: SurveyQuestionOption[];
  validation?: SurveyQuestionValidation;
  isRequired: boolean;
}

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface SurveyAnswer {
  questionId: ID;
  type: QuestionType;
  value: AnswerValue;
  answeredAt?: ISODateString;
}

export interface VoteAnswerDraft {
  questionId: ID;
  value: AnswerValue;
  isValid: boolean;
  error?: string;
}

export interface SurveyQuestionResultOption {
  optionId: ID;
  label: string;
  count: number;
  percent: number;
}

export interface SurveyQuestionResult {
  questionId: ID;
  questionTitle: string;
  questionType: QuestionType;
  totalResponses: number;
  options?: SurveyQuestionResultOption[];
  textSampleCount?: number;
}

/* ---------------------------------- */
/* main survey models                 */
/* ---------------------------------- */

export interface SurveySummary {
  id: ID;
  title: string;
  description: string;
  shortDescription?: string;
  status: SurveyStatus;
  visibility?: SurveyVisibility;

  categories: SurveyCategory[];
  tags?: SurveyTag[];
  badges?: SurveyBadge[];

  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  publishedAt?: ISODateString;

  timeline?: DateRange;
  timeInfo?: SurveyTimeInfo;

  budget?: SurveyBudget;
  progress?: SurveyProgress;

  requirements?: SurveyRequirement[];
  eligibility?: EligibilityCheckResult;

  estimatedMinutes?: number;
  questionCount?: number;

  anonymityMode?: boolean;
  creatorId?: ID;
  creatorDisplayName?: string;
}

export interface SurveyCard extends SurveySummary {
  listVariant: SurveyListVariant;
  primaryActionLabel?: string;
  primaryAction?: CreatorAction | 'vote' | 'continue' | 'details';
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

export interface SurveyResultDetail extends SurveySummary {
  results: SurveyQuestionResult[];
  totalResponses: number;
  paidResponses?: number;
  paidOut?: Money;
}

/* ---------------------------------- */
/* creation flow models               */
/* ---------------------------------- */

export interface SurveyDetailsDraft {
  title: string;
  description: string;
  startAt?: ISODateString;
  endAt?: ISODateString;
  categories: SurveyCategory[];
  tags?: SurveyTag[];
}

export interface SurveyQuestionsDraft {
  questions: SurveyQuestion[];
}

export interface SurveyRequirementsDraft {
  requirements: SurveyRequirement[];
}

export interface SurveyBudgetDraft {
  rewardPerVoter?: Money;
  paidCap?: number;
  rewardPool?: Money;
  platformFee?: Money;
  totalCost?: Money;
  anonymityMode?: boolean;
}

export interface SurveyDraft {
  id?: ID;
  details: SurveyDetailsDraft;
  questions: SurveyQuestionsDraft;
  requirements: SurveyRequirementsDraft;
  budget: SurveyBudgetDraft;
  status: Extract<SurveyStatus, 'draft' | 'scheduled' | 'live'>;
  lastSavedAt?: ISODateString;
}

/* ---------------------------------- */
/* explore / filter / search models   */
/* ---------------------------------- */

export interface SurveyFilterState {
  query?: string;
  categoryIds?: ID[];
  rewardMin?: number;
  openOnly?: boolean;
  sortBy?: SurveySortOption;
}

export interface ActiveFilterChip {
  id: ID;
  label: string;
  field: keyof SurveyFilterState | string;
}

export interface ExploreSurveyList {
  items: SurveyCard[];
  totalCount: number;
  filters: SurveyFilterState;
  activeFilterChips: ActiveFilterChip[];
}

/* ---------------------------------- */
/* vote / participation models        */
/* ---------------------------------- */

export interface VoteSessionProgress {
  currentQuestionIndex: number;
  totalQuestions: number;
  completedQuestionIds: ID[];
  percentComplete: number;
}

export interface VoteVerificationStep {
  id: ID;
  label: string;
  status: VerificationStepStatus;
  message?: string;
}

export interface VoteVerificationState {
  provider: VerificationProvider;
  walletAddress?: WalletAddress;
  deeplinkUrl?: string;
  qrCodeUrl?: string;
  sessionId?: ID;
  expiresAt?: ISODateString;
  steps?: VoteVerificationStep[];
}

export interface VoteSession {
  id: ID;
  surveyId: ID;
  surveyTitle: string;

  status: VoteLifecycleStatus;
  startedAt: ISODateString;
  submittedAt?: ISODateString;
  verifiedAt?: ISODateString;
  completedAt?: ISODateString;

  currentQuestionIndex: number;
  totalQuestions: number;
  answers: VoteAnswerDraft[];

  eligibility?: EligibilityCheckResult;
  verification?: VoteVerificationState;

  reward?: Money;
  rewardStatus?: RewardStatus;
}

export interface VoteSubmissionReceipt {
  voteId: ID;
  surveyId: ID;
  submittedAt: ISODateString;
  status: VoteLifecycleStatus;
  verificationStatus: 'verified' | 'pending' | 'failed';
  reward?: Money;
  rewardStatus?: RewardStatus;
  walletAddress?: WalletAddress;
}

export interface VoteHistoryItem {
  voteId: ID;
  surveyId: ID;
  surveyTitle: string;
  categoryLabel?: string;
  votedAt: ISODateString;
  rewardStatus: RewardStatus;
  reward?: Money;
  note?: string;
}

export interface ParticipatedSurveySummary {
  surveyId: ID;
  title: string;
  categoryLabel?: string;
  votedAt: ISODateString;
  rewardStatus: RewardStatus;
  reward?: Money;
  note?: string;
}

export interface VoterDashboardStats {
  totalEarned?: Money;
  totalVoted: number;
  unpaidVotes: number;
}

/* ---------------------------------- */
/* creator dashboard models           */
/* ---------------------------------- */

export interface CreatorRecentResponse {
  id: ID;
  pseudonym: string; // e.g. "Anon #4821"
  respondedAt: ISODateString;
  rewardStatus: RewardStatus;
  reward?: Money;
}

export interface CreatorSurveyStats {
  totalResponses: number;
  paidResponses: number;
  paidCap: number;
  remainingBudget?: Money;
  spentAmount?: Money;
}

export interface CreatedSurveySummary extends SurveySummary {
  allowedActions?: CreatorAction[];
}

export interface CreatorDashboardSection {
  activeSurvey?: CreatedSurveySummary;
  createdSurveys?: CreatedSurveySummary[];
  completedSurveys?: CreatedSurveySummary[];
}

/* ---------------------------------- */
/* home / landing models              */
/* ---------------------------------- */

export interface HomeDashboardData {
  activeSurvey?: CreatedSurveySummary;
  recentlyParticipated?: ParticipatedSurveySummary[];
  availableForYou?: SurveyCard[];
}
