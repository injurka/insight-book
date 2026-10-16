CREATE TABLE `book_deck_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer NOT NULL,
	`name` text NOT NULL,
	`language` text NOT NULL,
	`targetLanguage` text NOT NULL,
	`words` text NOT NULL,
	`deckId` integer,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deckId`) REFERENCES `dict_decks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_deck_drafts_userId_bookId_targetLanguage_unique` ON `book_deck_drafts` (`userId`,`bookId`,`targetLanguage`);