CREATE TABLE `catalog_plugin_versions` (
	`pluginId` text NOT NULL,
	`version` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`author` text,
	`sourceUrl` text,
	`manifestUrl` text NOT NULL,
	`uploadedBy` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`pluginId`, `version`),
	FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `catalog_plugin_versions_status_idx` ON `catalog_plugin_versions` (`status`);--> statement-breakpoint
CREATE INDEX `catalog_plugin_versions_uploader_idx` ON `catalog_plugin_versions` (`uploadedBy`);--> statement-breakpoint
INSERT INTO `catalog_plugin_versions` (`pluginId`, `version`, `name`, `description`, `icon`, `author`, `sourceUrl`, `manifestUrl`, `uploadedBy`, `status`, `createdAt`, `updatedAt`) SELECT `id`, `version`, `name`, `description`, `icon`, `author`, `sourceUrl`, `manifestUrl`, `uploadedBy`, `status`, `createdAt`, `updatedAt` FROM `catalog_plugins`;