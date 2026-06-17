PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`passwordHash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`tokenLimit` integer DEFAULT 1000000,
	`bookLimit` integer DEFAULT 10,
	`usedTokens` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`pushTargetDeckId` integer,
	`pushTimeStart` text DEFAULT '10:00' NOT NULL,
	`pushTimeEnd` text DEFAULT '21:00' NOT NULL,
	`pushCount` integer DEFAULT 1 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`uiLanguage` text DEFAULT 'ru' NOT NULL,
	`lastPushSentAt` text,
	`avatarUrl` text,
	`yandexId` text
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "passwordHash", "role", "tokenLimit", "bookLimit", "usedTokens", "createdAt", "pushTargetDeckId", "pushTimeStart", "pushTimeEnd", "pushCount", "timezone", "uiLanguage", "lastPushSentAt", "avatarUrl", "yandexId") SELECT "id", "username", "passwordHash", "role", "tokenLimit", "bookLimit", "usedTokens", "createdAt", "pushTargetDeckId", "pushTimeStart", "pushTimeEnd", "pushCount", "timezone", "uiLanguage", "lastPushSentAt", "avatarUrl", "yandexId" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_yandexId_unique` ON `users` (`yandexId`);