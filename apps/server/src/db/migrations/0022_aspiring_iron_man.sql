ALTER TABLE `books` ADD `isUnlisted` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `publicStatus` text DEFAULT 'private' NOT NULL;