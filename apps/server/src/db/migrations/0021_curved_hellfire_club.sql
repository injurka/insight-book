CREATE TABLE `limit_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`periodStart` text NOT NULL,
	`periodEnd` text NOT NULL,
	`usedTokens` integer DEFAULT 0 NOT NULL,
	`usedBooks` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`passwordHash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`tokenLimit` integer DEFAULT 100000,
	`bookLimit` integer DEFAULT 3,
	`usedTokens` integer DEFAULT 0 NOT NULL,
	`periodStart` text DEFAULT (datetime('now')) NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`pushTargetDeckId` integer,
	`pushTimeStart` text DEFAULT '10:00' NOT NULL,
	`pushTimeEnd` text DEFAULT '21:00' NOT NULL,
	`pushCount` integer DEFAULT 1 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`uiLanguage` text DEFAULT 'ru' NOT NULL,
	`lastPushSentAt` text,
	`avatarUrl` text,
	`email` text,
	`yandexId` text
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "passwordHash", "role", "tokenLimit", "bookLimit", "usedTokens", "periodStart", "createdAt", "pushTargetDeckId", "pushTimeStart", "pushTimeEnd", "pushCount", "timezone", "uiLanguage", "lastPushSentAt", "avatarUrl", "email", "yandexId") SELECT "id", "username", "passwordHash", "role", "tokenLimit", "bookLimit", "usedTokens", "periodStart", "createdAt", "pushTargetDeckId", "pushTimeStart", "pushTimeEnd", "pushCount", "timezone", "uiLanguage", "lastPushSentAt", "avatarUrl", "email", "yandexId" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_yandexId_unique` ON `users` (`yandexId`);