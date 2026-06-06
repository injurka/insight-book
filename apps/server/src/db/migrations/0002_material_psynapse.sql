CREATE TABLE `dump_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prefix` text NOT NULL,
	`status` text DEFAULT 'in-progress' NOT NULL,
	`error` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`completedAt` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer DEFAULT 1 NOT NULL,
	`type` text DEFAULT 'epub' NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`coverUrl` text,
	`filePath` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`totalPages` integer DEFAULT 0 NOT NULL,
	`toc` text,
	`series` text,
	`seriesNumber` integer,
	`status` text DEFAULT 'reading' NOT NULL,
	`isFavorite` integer DEFAULT 0 NOT NULL,
	`collection` text,
	`isPublic` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_books`("id", "userId", "type", "title", "author", "coverUrl", "filePath", "language", "totalPages", "toc", "series", "seriesNumber", "status", "isFavorite", "collection", "isPublic", "createdAt", "updatedAt") SELECT "id", "userId", "type", "title", "author", "coverUrl", "filePath", "language", "totalPages", "toc", "series", "seriesNumber", "status", "isFavorite", "collection", "isPublic", "createdAt", "updatedAt" FROM `books`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_reading_progress` (
	`bookId` integer NOT NULL,
	`userId` integer DEFAULT 1 NOT NULL,
	`currentPage` integer DEFAULT 1 NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`bookId`, `userId`),
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reading_progress`("bookId", "userId", "currentPage", "updatedAt") SELECT "bookId", "userId", "currentPage", "updatedAt" FROM `reading_progress`;--> statement-breakpoint
DROP TABLE `reading_progress`;--> statement-breakpoint
ALTER TABLE `__new_reading_progress` RENAME TO `reading_progress`;