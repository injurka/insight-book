CREATE TABLE `user_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`event` text NOT NULL,
	`meta` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_events_user_created_idx` ON `user_events` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_events_event_created_idx` ON `user_events` (`event`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_events_created_idx` ON `user_events` (`createdAt`);