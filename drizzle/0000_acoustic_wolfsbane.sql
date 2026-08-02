CREATE TABLE "wow_token_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"price_gold" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wow_token_prices_region_timestamp_unique" ON "wow_token_prices" USING btree ("region","timestamp");--> statement-breakpoint
CREATE INDEX "wow_token_prices_region_timestamp_idx" ON "wow_token_prices" USING btree ("region","timestamp");