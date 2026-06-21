CREATE TABLE IF NOT EXISTS `highlights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer NOT NULL,
	`text` text NOT NULL,
	`translation` text,
	`note` text,
	`color` text DEFAULT '#fde047' NOT NULL,
	`chapter` text,
	`pageNum` integer NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
