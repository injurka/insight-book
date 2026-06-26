ALTER TABLE `user_dictionary` ADD `state` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `due` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `stability` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `difficultyFsrs` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `scheduledDays` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `reps` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `lapses` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `lastReview` text;
--> statement-breakpoint
ALTER TABLE `user_dictionary` ADD `learningSteps` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

UPDATE `user_dictionary`
SET
  `state` = CASE
    WHEN `status` = 0 THEN 0
    WHEN `status` = 1 THEN 1
    WHEN `status` = 2 THEN 2
    WHEN `status` = 3 THEN 2
    ELSE 0
  END,
  `due` = CASE WHEN `nextReviewDate` IS NOT NULL THEN `nextReviewDate` ELSE `due` END,
  `scheduledDays` = CAST(`interval` AS INTEGER),
  `reps` = `repetitions`,
  `stability` = CASE
    WHEN `status` = 0 THEN 0.0
    WHEN `interval` < 0.1 THEN 0.1   
    ELSE `interval`
  END,
  `difficultyFsrs` = CASE
    WHEN `status` = 0 THEN 0.0
    WHEN `easeFactor` > 2.5 THEN 3.0
    WHEN `easeFactor` = 2.5 THEN 5.0
    ELSE 7.0
  END
WHERE `status` IS NOT NULL;

--> statement-breakpoint
ALTER TABLE `user_dictionary` DROP COLUMN `status`;
--> statement-breakpoint
ALTER TABLE `user_dictionary` DROP COLUMN `repetitions`;
--> statement-breakpoint
ALTER TABLE `user_dictionary` DROP COLUMN `interval`;
--> statement-breakpoint
ALTER TABLE `user_dictionary` DROP COLUMN `easeFactor`;
--> statement-breakpoint
ALTER TABLE `user_dictionary` DROP COLUMN `nextReviewDate`;
