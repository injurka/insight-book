ALTER TABLE `llm_logs` ADD `audioInputSeconds` real;--> statement-breakpoint
ALTER TABLE `llm_logs` ADD `audioOutputSeconds` real;--> statement-breakpoint
ALTER TABLE `token_usage` ADD `audioInputSeconds` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `token_usage` ADD `audioOutputSeconds` real DEFAULT 0;