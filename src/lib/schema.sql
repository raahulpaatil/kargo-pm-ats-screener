create extension if not exists pgcrypto;

create table if not exists candidates (
  id            uuid primary key default gen_random_uuid(),
  role          text not null check (role in ('PM','SPM')),
  name          text,
  email         text,
  status        text not null default 'pending' check (status in ('pending','accepted','rejected')),
  file_url      text not null,
  file_name     text not null,
  resume_text   text not null,
  batch_id      uuid,
  created_at    timestamptz not null default now()
);

create table if not exists scores (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null unique references candidates(id) on delete cascade,
  metric_1_score      int not null check (metric_1_score between 1 and 4),
  metric_1_rationale  text not null,
  metric_2_score      int not null check (metric_2_score between 1 and 4),
  metric_2_rationale  text not null,
  metric_3_score      int not null check (metric_3_score between 1 and 4),
  metric_3_rationale  text not null,
  metric_4_score      int not null check (metric_4_score between 1 and 4),
  metric_4_rationale  text not null,
  metric_5_score      int not null check (metric_5_score between 1 and 4),
  metric_5_rationale  text not null,
  total_raw           int not null,
  total_100           int not null,
  flag_hidden_fit     boolean not null default false,
  flag_spec_shallow   boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_candidates_batch_id on candidates(batch_id);
