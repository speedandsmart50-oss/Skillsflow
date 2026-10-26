import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("learning academy migration adds versioned learning records without altering existing tables", async () => {
  const migration = await readFile(new URL("../supabase/migrations/036_closing_academy_foundation.sql", import.meta.url), "utf8");
  const tables = [
    "learning_tracks", "learning_competencies", "learning_modules", "learning_lessons", "learning_exercises",
    "learning_content_versions", "learning_exercise_competencies", "learning_sources", "learning_module_progress",
    "learning_attempts", "learning_competency_progress", "learning_reviews", "learning_preferences",
  ];
  for (const table of tables) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from public\.(?!learning_))/i);
});

test("learning content is staff-published and member submissions cannot write evaluations", async () => {
  const migration = await readFile(new URL("../supabase/migrations/036_closing_academy_foundation.sql", import.meta.url), "utf8");
  assert.match(migration, /learning_user_can_access_content[\s\S]*community_memberships[\s\S]*community_rules/i);
  assert.match(migration, /learning_tracks_read_published[\s\S]*status = 'published'/i);
  assert.match(migration, /learning_tracks_staff_manage[\s\S]*community_is_staff\(\)/i);
  assert.match(migration, /grant select, insert \(user_id, exercise_id, submitted_content\) on public\.learning_attempts to authenticated/i);
  assert.match(migration, /learning_attempts_insert_self[\s\S]*feedback is null and competency_scores is null and evaluated_by is null/i);
  assert.match(migration, /learning_attempts_staff_evaluate[\s\S]*community_is_staff\(\)/i);
  assert.match(migration, /learning_attempts_read_self[\s\S]*user_id = auth\.uid\(\)/i);
});
