CREATE TABLE `user_plugins` (
	`userId` integer NOT NULL,
	`pluginId` text NOT NULL,
	`manifestUrl` text NOT NULL,
	`settings` text,
	`isEnabled` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`userId`, `pluginId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
