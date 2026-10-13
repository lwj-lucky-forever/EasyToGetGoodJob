ALTER TABLE `jobs` ADD `priority` text DEFAULT '中' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `application_deadline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `reminder_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `resume_version` text DEFAULT '通用版' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `process_records_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `prep_checklist_json` text DEFAULT '[]' NOT NULL;