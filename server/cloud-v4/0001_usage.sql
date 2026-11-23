CREATE TABLE atlas_ai_daily (
  day TEXT NOT NULL,
  user_hash TEXT NOT NULL,
  requests INTEGER NOT NULL,
  PRIMARY KEY (day, user_hash)
);
