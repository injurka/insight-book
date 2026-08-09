PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tts_cache` (
	`textHash` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`audioBlob` blob NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tts_cache`("textHash", "text", "audioBlob", "createdAt") SELECT "textHash", "text", "audioBlob", "createdAt" FROM `tts_cache`;--> statement-breakpoint
DROP TABLE `tts_cache`;--> statement-breakpoint
ALTER TABLE `__new_tts_cache` RENAME TO `tts_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_llm_cache` (
	`sentenceHash` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`sentence` text NOT NULL,
	`analysis` blob NOT NULL,
	`targetLanguage` text DEFAULT 'ru' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_llm_cache`("sentenceHash", "language", "sentence", "analysis", "targetLanguage", "createdAt") SELECT "sentenceHash", "language", "sentence", "analysis", "targetLanguage", "createdAt" FROM `llm_cache`;--> statement-breakpoint
DROP TABLE `llm_cache`;--> statement-breakpoint
ALTER TABLE `__new_llm_cache` RENAME TO `llm_cache`;--> statement-breakpoint
CREATE TABLE `__new_nlp_cache` (
	`bookId` integer NOT NULL,
	`pageNum` integer NOT NULL,
	`data` blob NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_nlp_cache`("bookId", "pageNum", "data") SELECT "bookId", "pageNum", "data" FROM `nlp_cache`;--> statement-breakpoint
DROP TABLE `nlp_cache`;--> statement-breakpoint
ALTER TABLE `__new_nlp_cache` RENAME TO `nlp_cache`;