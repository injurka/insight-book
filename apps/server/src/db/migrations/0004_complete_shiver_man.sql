ALTER TABLE `users` ADD `pushTargetDeckId` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `pushTimeStart` text DEFAULT '10:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `pushTimeEnd` text DEFAULT '21:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastPushSentAt` text;