ALTER TABLE `books` ADD `status` text DEFAULT 'reading' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `isFavorite` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `collection` text;