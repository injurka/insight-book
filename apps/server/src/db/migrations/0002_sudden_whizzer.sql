CREATE TABLE `token_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`date` text NOT NULL,
	`action` text NOT NULL,
	`model` text NOT NULL,
	`inputTokens` integer DEFAULT 0 NOT NULL,
	`outputTokens` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_usage_userId_date_action_model_unique` ON `token_usage` (`userId`,`date`,`action`,`model`);