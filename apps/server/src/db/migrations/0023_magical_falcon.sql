CREATE TABLE `word_to_deck` (
	`wordId` integer NOT NULL,
	`deckId` integer NOT NULL,
	PRIMARY KEY(`wordId`, `deckId`),
	FOREIGN KEY (`wordId`) REFERENCES `user_dictionary`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deckId`) REFERENCES `dict_decks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `word_to_deck` (`wordId`, `deckId`)
SELECT `id`, `deckId` FROM `user_dictionary` WHERE `deckId` IS NOT NULL AND `deckId` IN (SELECT `id` FROM `dict_decks`);
