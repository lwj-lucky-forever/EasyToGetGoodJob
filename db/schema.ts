import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    company: text("company").notNull(),
    role: text("role").notNull(),
    location: text("location").notNull().default(""),
    nature: text("nature").notNull().default("日常实习"),
    status: text("status").notNull().default("未投递"),
    responsibilities: text("responsibilities").notNull().default(""),
    requirements: text("requirements").notNull().default(""),
    competencies: text("competencies").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    rawText: text("raw_text").notNull().default(""),
    matchScore: integer("match_score"),
    matchLevel: text("match_level").notNull().default(""),
    analysisJson: text("analysis_json").notNull().default(""),
    analysisVersion: integer("analysis_version").notNull().default(1),
    analyzedAt: text("analyzed_at"),
    priority: text("priority").notNull().default("中"),
    applicationDeadline: text("application_deadline").notNull().default(""),
    reminderAt: text("reminder_at").notNull().default(""),
    resumeVersion: text("resume_version").notNull().default("通用版"),
    processRecordsJson: text("process_records_json").notNull().default("[]"),
    prepChecklistJson: text("prep_checklist_json").notNull().default("[]"),
    companyOrder: integer("company_order").notNull().default(0),
    jobOrder: integer("job_order").notNull().default(0),
    appliedAt: text("applied_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_jobs_owner_updated").on(table.ownerId, table.updatedAt),
    index("idx_jobs_owner_status").on(table.ownerId, table.status),
    index("idx_jobs_owner_custom_order").on(table.ownerId, table.companyOrder, table.jobOrder),
  ],
);

export const resumeProfiles = sqliteTable(
  "resume_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    content: text("content").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_resume_profiles_owner_name").on(table.ownerId, table.name)],
);

export const interviewReviews = sqliteTable(
  "interview_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    questionKey: text("question_key").notNull().default(""),
    company: text("company").notNull().default(""),
    role: text("role").notNull().default(""),
    category: text("category").notNull().default("综合"),
    question: text("question").notNull(),
    answer: text("answer").notNull().default(""),
    selfScore: integer("self_score").notNull().default(0),
    reviewNotes: text("review_notes").notNull().default(""),
    nextAction: text("next_action").notNull().default(""),
    sourceType: text("source_type").notNull().default("模拟练习"),
    interviewRound: text("interview_round").notNull().default(""),
    interviewDate: text("interview_date").notNull().default(""),
    jobId: integer("job_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_interview_reviews_owner_updated").on(table.ownerId, table.updatedAt),
    index("idx_interview_reviews_owner_company").on(table.ownerId, table.company),
  ],
);
