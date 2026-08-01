CREATE TABLE `wow_token_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`region` text NOT NULL,
	`price_gold` integer NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wow_token_prices_region_timestamp_unique` ON `wow_token_prices` (`region`,`timestamp`);--> statement-breakpoint
CREATE INDEX `wow_token_prices_region_timestamp_idx` ON `wow_token_prices` (`region`,`timestamp`);