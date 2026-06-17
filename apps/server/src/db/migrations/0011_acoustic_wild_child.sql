ALTER TABLE `users` ADD `yandexId` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_yandexId_unique` ON `users` (`yandexId`);