CREATE TABLE "benchmark_stats" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "benchmark_stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"score_bucket" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "benchmark_stats_score_bucket_unique" UNIQUE("score_bucket")
);
--> statement-breakpoint
CREATE TABLE "benchmark_summary" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"total_validations" integer DEFAULT 0 NOT NULL,
	"avg_score" numeric(5, 2) DEFAULT '0',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"logo_url" varchar(512),
	"website_url" varchar(512),
	"category" varchar(100),
	"country_code" varchar(2),
	"ucp_score" integer,
	"ucp_grade" varchar(2),
	"transports" varchar(255),
	"is_public" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE INDEX "idx_merchants_domain" ON "merchants" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_merchants_category" ON "merchants" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_merchants_country" ON "merchants" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_merchants_score" ON "merchants" USING btree ("ucp_score");--> statement-breakpoint
CREATE INDEX "idx_merchants_public" ON "merchants" USING btree ("is_public");