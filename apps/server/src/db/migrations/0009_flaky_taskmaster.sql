ALTER TABLE `reading_progress` ADD `status` text DEFAULT 'reading' NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_progress` ADD `isFavorite` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_progress` ADD `collection` text;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `isFavorite`;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `collection`;