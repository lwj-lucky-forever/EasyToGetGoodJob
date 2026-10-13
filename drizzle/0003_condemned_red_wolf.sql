ALTER TABLE `jobs` ADD `company_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `job_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_jobs_owner_custom_order` ON `jobs` (`owner_id`,`company_order`,`job_order`);