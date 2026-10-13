CREATE TABLE `interview_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`question_key` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '综合' NOT NULL,
	`question` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`self_score` integer DEFAULT 0 NOT NULL,
	`review_notes` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT '模拟练习' NOT NULL,
	`interview_round` text DEFAULT '' NOT NULL,
	`interview_date` text DEFAULT '' NOT NULL,
	`job_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_interview_reviews_owner_updated` ON `interview_reviews` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_interview_reviews_owner_company` ON `interview_reviews` (`owner_id`,`company`);