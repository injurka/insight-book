ALTER TABLE `tts_cache` ADD `model` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `tts_cache` ADD `provider` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `tts_cache` ADD `voice` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `tts_cache` ADD `requestedVoice` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE INDEX `tts_cache_model_idx` ON `tts_cache` (`model`);--> statement-breakpoint
CREATE INDEX `tts_cache_text_voice_idx` ON `tts_cache` (`text`,`voice`);