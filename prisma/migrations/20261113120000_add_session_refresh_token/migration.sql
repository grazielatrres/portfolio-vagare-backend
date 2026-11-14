-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "refresh_token_hash" TEXT,
ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");
