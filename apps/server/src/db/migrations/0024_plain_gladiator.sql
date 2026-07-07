PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_user_dictionary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer DEFAULT 1 NOT NULL,
	`word` text NOT NULL,
	`transcription` text,
	`translation` text,
	`language` text DEFAULT 'en' NOT NULL,
	`targetLanguage` text DEFAULT 'ru' NOT NULL,
	`notes` text,
	`tags` text,
	`difficulty` text,
	`grammarNote` text,
	`vocabularyNote` text,
	`state` integer DEFAULT 0 NOT NULL,
	`due` text DEFAULT (datetime('now')) NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficultyFsrs` real DEFAULT 0 NOT NULL,
	`scheduledDays` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`lastReview` text,
	`learningSteps` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_dictionary`("id", "userId", "word", "transcription", "translation", "language", "targetLanguage", "notes", "tags", "difficulty", "grammarNote", "vocabularyNote", "state", "due", "stability", "difficultyFsrs", "scheduledDays", "reps", "lapses", "lastReview", "learningSteps", "createdAt", "updatedAt") SELECT "id", "userId", "word", "transcription", "translation", "language", "targetLanguage", "notes", "tags", "difficulty", "grammarNote", "vocabularyNote", "state", "due", "stability", "difficultyFsrs", "scheduledDays", "reps", "lapses", "lastReview", "learningSteps", "createdAt", "updatedAt" FROM `user_dictionary`;--> statement-breakpoint
DROP TABLE `user_dictionary`;--> statement-breakpoint
ALTER TABLE `__new_user_dictionary` RENAME TO `user_dictionary`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_dictionary_userId_word_targetLanguage_unique` ON `user_dictionary` (`userId`,`word`,`targetLanguage`);