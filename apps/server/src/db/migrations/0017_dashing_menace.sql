CREATE TABLE `book_tts_cache` (
	`bookId` integer NOT NULL,
	`textHash` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`bookId`, `textHash`),
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`textHash`) REFERENCES `tts_cache`(`textHash`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `book_llm_cache` ADD `type` text DEFAULT 'sentence' NOT NULL;--> statement-breakpoint
ALTER TABLE `book_stats` ADD `totalSentences` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `book_stats` ADD `totalWords` integer DEFAULT 0;