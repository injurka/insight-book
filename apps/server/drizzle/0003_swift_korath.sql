CREATE TABLE `opds_catalogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `grammarNote` text;--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `vocabularyNote` text;