ALTER TABLE `jobs` ADD `match_score` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `match_level` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `analysis_json` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `analysis_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `analyzed_at` text;