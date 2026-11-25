ALTER TABLE `daily_activity` ADD `activeSeconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_activity` ADD `readingSeconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_activity` ADD `srsSeconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastActiveAt` text;