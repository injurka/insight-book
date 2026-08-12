-- Таблица могла быть создана вручную в ходе предыдущей (незавершённой) итерации с нелокализованной схемой.
-- DROP IF EXISTS гарантирует чистое применение миграции на любой БД; данные тарифов сидируются сервисом.
DROP TABLE IF EXISTS `subscription_tiers`;
--> statement-breakpoint
CREATE TABLE `subscription_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`icon` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`dailyTokenLimit` integer,
	`dailyBookLimit` integer,
	`isPopular` integer DEFAULT false NOT NULL,
	`gradient` text NOT NULL,
	`accentColor` text NOT NULL,
	`badgeEn` text NOT NULL,
	`badgeRu` text NOT NULL,
	`badgeZh` text NOT NULL,
	`nameEn` text NOT NULL,
	`nameRu` text NOT NULL,
	`nameZh` text NOT NULL,
	`descriptionEn` text NOT NULL,
	`descriptionRu` text NOT NULL,
	`descriptionZh` text NOT NULL,
	`featuresEn` text NOT NULL,
	`featuresRu` text NOT NULL,
	`featuresZh` text NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
