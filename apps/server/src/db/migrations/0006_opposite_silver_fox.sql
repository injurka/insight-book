ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tokenLimit` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `bookLimit` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `usedTokens` integer DEFAULT 0 NOT NULL;