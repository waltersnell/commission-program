CREATE TABLE "CrmStepTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CrmStepTemplate_key_key" ON "CrmStepTemplate"("key");

INSERT INTO "CrmStepTemplate" ("id", "key", "label", "content", "sortOrder", "updatedAt")
VALUES
  ('crm_initial_text_message', 'initialTextMessage', 'Initial Text Message', '', 10, CURRENT_TIMESTAMP),
  ('crm_final_text_message', 'finalTextMessage', 'Final Text Message', '', 20, CURRENT_TIMESTAMP),
  ('crm_initial_email', 'initialEmail', 'Initial Email', '', 30, CURRENT_TIMESTAMP),
  ('crm_final_email', 'finalEmail', 'Final Email', '', 40, CURRENT_TIMESTAMP),
  ('crm_initial_voice_script', 'initialVoiceScript', 'Initial Voice Script', '', 50, CURRENT_TIMESTAMP);
