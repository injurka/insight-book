CREATE TABLE `web_push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`endpoint` text NOT NULL,
	`keys` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_push_subscriptions_endpoint_unique` ON `web_push_subscriptions` (`endpoint`);