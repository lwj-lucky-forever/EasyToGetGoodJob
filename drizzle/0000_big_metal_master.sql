CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`nature` text DEFAULT '日常实习' NOT NULL,
	`status` text DEFAULT '未投递' NOT NULL,
	`responsibilities` text DEFAULT '' NOT NULL,
	`requirements` text DEFAULT '' NOT NULL,
	`competencies` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`raw_text` text DEFAULT '' NOT NULL,
	`applied_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_owner_updated` ON `jobs` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_jobs_owner_status` ON `jobs` (`owner_id`,`status`);