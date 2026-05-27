CREATE TABLE `book_llm_cache` (
	`bookId` integer NOT NULL,
	`sentenceHash` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`bookId`, `sentenceHash`),
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sentenceHash`) REFERENCES `llm_cache`(`sentenceHash`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`pageNum` integer NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_pages_bookId_pageNum_unique` ON `book_pages` (`bookId`,`pageNum`);--> statement-breakpoint
CREATE TABLE `book_stats` (
	`bookId` integer PRIMARY KEY NOT NULL,
	`description` text,
	`difficulty` text,
	`tags` text,
	`totalChars` integer DEFAULT 0,
	`uniqueChars` integer DEFAULT 0,
	`posDistribution` text,
	`topWords` text,
	`lexicalDiversity` integer,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `books` (
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
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `daily_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`date` text NOT NULL,
	`wordsAdded` integer DEFAULT 0 NOT NULL,
	`wordsReviewed` integer DEFAULT 0 NOT NULL,
	`pagesRead` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_activity_userId_date_unique` ON `daily_activity` (`userId`,`date`);--> statement-breakpoint
CREATE TABLE `dict_decks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `llm_cache` (
	`sentenceHash` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`sentence` text NOT NULL,
	`analysis` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `manga_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bookId` integer NOT NULL,
	`pageNum` integer NOT NULL,
	`imageUrl` text NOT NULL,
	`imageWidth` integer NOT NULL,
	`imageHeight` integer NOT NULL,
	`ocrData` text,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manga_pages_bookId_pageNum_unique` ON `manga_pages` (`bookId`,`pageNum`);--> statement-breakpoint
CREATE TABLE `nlp_cache` (
	`bookId` integer NOT NULL,
	`pageNum` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_progress` (
	`bookId` integer PRIMARY KEY NOT NULL,
	`currentPage` integer DEFAULT 1 NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tts_cache` (
	`textHash` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`audioBase64` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_dictionary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer DEFAULT 1 NOT NULL,
	`deckId` integer,
	`word` text NOT NULL,
	`transcription` text,
	`translation` text,
	`language` text DEFAULT 'en' NOT NULL,
	`notes` text,
	`tags` text,
	`difficulty` text,
	`status` integer DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`interval` real DEFAULT 0 NOT NULL,
	`easeFactor` real DEFAULT 2.5 NOT NULL,
	`nextReviewDate` text DEFAULT (datetime('now')) NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deckId`) REFERENCES `dict_decks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_dictionary_userId_word_unique` ON `user_dictionary` (`userId`,`word`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`passwordHash` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `word_encounters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`wordId` integer NOT NULL,
	`bookId` integer,
	`sentence` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wordId`) REFERENCES `user_dictionary`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `word_encounters_wordId_sentence_unique` ON `word_encounters` (`wordId`,`sentence`);