CREATE TABLE `members` (
	`token` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`slot` integer NOT NULL,
	`name` text NOT NULL,
	`seen` integer NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_slot` ON `members` (`room`,`slot`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`owner` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`duration` integer DEFAULT 1500 NOT NULL,
	`remaining` integer DEFAULT 1500 NOT NULL,
	`ends_at` integer,
	`phase` text DEFAULT 'focus' NOT NULL,
	`run_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`seconds` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`owner` integer NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
