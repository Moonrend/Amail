CREATE TABLE `analytics_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`api_key_id` text,
	`total_sent` integer DEFAULT 0 NOT NULL,
	`total_delivered` integer DEFAULT 0 NOT NULL,
	`total_failed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_analytics_daily_unique` ON `analytics_daily` (`date`,`api_key_id`);--> statement-breakpoint
CREATE INDEX `idx_analytics_daily_date` ON `analytics_daily` (`date`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_used_at` text,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`api_key_id` text,
	`smtp_config_id` text,
	`from_address` text NOT NULL,
	`to_addresses` text NOT NULL,
	`subject` text NOT NULL,
	`has_html` integer DEFAULT 0 NOT NULL,
	`has_text` integer DEFAULT 0 NOT NULL,
	`has_attachments` integer DEFAULT 0 NOT NULL,
	`attachment_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error_message` text,
	`idempotency_key` text,
	`message_id` text,
	`scheduled_at` text,
	`queued_at` text DEFAULT '' NOT NULL,
	`sent_at` text,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_email_logs_status` ON `email_logs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_api_key` ON `email_logs` (`api_key_id`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_created` ON `email_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_idempotency` ON `email_logs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `smtp_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`host` text NOT NULL,
	`port` integer DEFAULT 587 NOT NULL,
	`secure` integer DEFAULT 0 NOT NULL,
	`auth_type` text DEFAULT 'password' NOT NULL,
	`username` text,
	`password_encrypted` text,
	`oauth2_client_id` text,
	`oauth2_client_secret_encrypted` text,
	`oauth2_refresh_token_encrypted` text,
	`oauth2_access_token` text,
	`oauth2_token_expires` integer,
	`oauth2_tenant_id` text,
	`from_address` text,
	`from_name` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
