DROP INDEX `user_dictionary_userId_word_unique`;--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `targetLanguage` text DEFAULT 'ru' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `user_dictionary_userId_word_targetLanguage_unique` ON `user_dictionary` (`userId`,`word`,`targetLanguage`);--> statement-breakpoint
ALTER TABLE `dict_decks` ADD `targetLanguage` text DEFAULT 'ru' NOT NULL;