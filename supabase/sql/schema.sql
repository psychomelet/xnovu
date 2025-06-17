set
  search_path = notify, base, extensions, shared_types;

do $$
BEGIN
  PERFORM shared_types.ensure_enum_values(
    'notification_channel_type',
    ARRAY[
      'IN_APP',
      'EMAIL',
      'SMS',
      'CHAT',
      'PUSH'
    ]
  );
END
$$;

do $$
BEGIN
  PERFORM shared_types.ensure_enum_values(
    'notification_workflow_type',
    ARRAY[
      'STATIC',
      'DYNAMIC'
    ]
  );
END
$$;

do $$
BEGIN
  PERFORM shared_types.ensure_enum_values(
    'notification_status',
    ARRAY[
      'PENDING',
      'PROCESSING',
      'SENT',
      'FAILED',
      'RETRACTED'
    ]
  );
END
$$;

-- ======================================================
-- 1. TYPE TABLES (typ_*)
-- ======================================================
-- Req Ref: "Message Center Management" (Message Types), "User Message Template Management" (Template Types), and general categorization for various notifications.
create table if not exists notify.typ_notification_category (
  id BIGINT generated always as identity primary key,
  name TEXT not null,
  description TEXT,
  code TEXT unique,
  publish_status shared_types.publish_status default 'DRAFT' not null,
  deactivated BOOLEAN default false not null,
  path LTREE,
  path_text TEXT GENERATED ALWAYS as (path::TEXT) STORED,
  sort_order INTEGER default 0 not null,
  business_id UUID,
  repr TEXT GENERATED ALWAYS as (func.normalize_repr (name)) STORED,
  enterprise_id UUID,
  created_at TIMESTAMPTZ default NOW() not null,
  created_by UUID default auth.user_id (),
  updated_at TIMESTAMPTZ default NOW() not null,
  updated_by UUID default auth.user_id (),
  constraint uq_typ_notification_category_name_enterprise unique (name, enterprise_id)
);

COMMENT on table notify.typ_notification_category is 'Defines hierarchical categories for notifications, workflows, and rules (e.g., Fire Drill, System Alert).';

-- Req Ref: "Message Center Management" (Message Priority Levels)
create table if not exists notify.typ_notification_priority (
  id BIGINT generated always as identity primary key,
  name TEXT not null, -- e.g., High, Medium, Low
  description TEXT,
  code TEXT unique,
  publish_status shared_types.publish_status default 'DRAFT' not null,
  deactivated BOOLEAN default false not null,
  sort_order INTEGER default 0 not null, -- Higher value can mean higher priority
  business_id UUID,
  repr TEXT GENERATED ALWAYS as (func.normalize_repr (name)) STORED,
  enterprise_id UUID,
  created_at TIMESTAMPTZ default NOW() not null,
  created_by UUID default auth.user_id (),
  updated_at TIMESTAMPTZ default NOW() not null,
  updated_by UUID default auth.user_id (),
  constraint uq_typ_notification_priority_name_enterprise unique (name, enterprise_id)
);

COMMENT on table notify.typ_notification_priority is 'Defines priority levels for notifications, like High, Medium, Low.';

-- ======================================================
-- 2. ENTITY TABLES (ent_*)
-- ======================================================
-- Req Ref: Numerous "Notification Content Template Management" sections (Fire Drill, Duty, Promotion, Training, etc.), "User Message Template Management"
create table if not exists notify.ent_notification_template (
  id BIGINT generated always as identity primary key,
  name TEXT not null,
  description TEXT,
  template_key TEXT unique,
  publish_status shared_types.publish_status default 'DRAFT' not null,
  deactivated BOOLEAN default false not null, -- For "Enable Status" or "Template Enable/Disable"
  typ_notification_category_id BIGINT references notify.typ_notification_category (id) on delete set null,
  business_id UUID,
  channel_type shared_types.notification_channel_type not null,
  subject_template TEXT, -- For channels like email that support a subject line
  body_template TEXT not null, -- Content template, can use placeholders like {{variable}}
  variables_description JSONB, -- Describes available placeholders and their meanings, e.g., {"username": "Recipient''s name", "event_time": "Time of the event"}
  repr TEXT GENERATED ALWAYS as (func.normalize_repr (name)) STORED,
  enterprise_id UUID,
  created_at TIMESTAMPTZ default NOW() not null,
  created_by UUID default auth.user_id (),
  updated_at TIMESTAMPTZ default NOW() not null,
  updated_by UUID default auth.user_id (),
  constraint uq_ent_notification_template_name_enterprise_category unique (name, enterprise_id, typ_notification_category_id)
);

COMMENT on table notify.ent_notification_template is 'Stores standalone content templates that are queried by the workflow engine at runtime to render notification payloads into actual message content. Each template defines channel-specific formatting with support for variable placeholders.';

-- Req Ref: Bridge to external notification system (e.g., Novu) for all notification types.
create table if not exists notify.ent_notification_workflow (
  id BIGINT generated always as identity primary key,
  name TEXT not null,
  description TEXT,
  publish_status shared_types.publish_status default 'DRAFT' not null,
  deactivated BOOLEAN default false not null,
  typ_notification_category_id BIGINT references notify.typ_notification_category (id) on delete set null,
  business_id UUID,
  workflow_type shared_types.notification_workflow_type not null,
  workflow_key TEXT not null unique, -- Identifier used by the external system (Novu workflow ID)
  default_channels shared_types.notification_channel_type[], -- Default channels for this workflow
  payload_schema JSONB, -- JSON Schema for payload validation
  control_schema JSONB, -- JSON Schema for workflow controls
  template_overrides JSONB, -- Channel-specific template overrides
  repr TEXT GENERATED ALWAYS as (func.normalize_repr (workflow_key)) STORED,
  enterprise_id UUID,
  created_at TIMESTAMPTZ default NOW() not null,
  created_by UUID default auth.user_id (),
  updated_at TIMESTAMPTZ default NOW() not null,
  updated_by UUID default auth.user_id (),
  constraint uq_ent_notification_workflow_name_enterprise unique (name, enterprise_id)
);

COMMENT on table notify.ent_notification_workflow is 'Defines notification workflows that bridge to external notification systems via workflow_key (Novu workflow ID). Contains persistent template overrides for customization and serves as the execution engine for processing notifications.';

-- Req Ref: Generic "Notification Rule Management" (Notification Rule Management) for all modules.
create table if not exists notify.ent_notification_rule (
  id BIGINT generated always as identity primary key,
  name TEXT not null,
  description TEXT,
  publish_status shared_types.publish_status default 'DRAFT' not null,
  deactivated BOOLEAN default false not null, -- For "Enable/Disable" (Enable/Disable) of rules
  notification_workflow_id BIGINT not null references notify.ent_notification_workflow (id) on delete CASCADE,
  business_id UUID,
  trigger_type TEXT not null, -- e.g., 'EVENT', 'SCHEDULE', 'CRON'
  trigger_config JSONB, -- Configuration, e.g., {"event_name": "user.signup"} or {"cron": "0 9 * * MON"}
  rule_payload JSONB, -- For complex rules defined as javascript, as per design document.
  repr TEXT GENERATED ALWAYS as (func.normalize_repr (name)) STORED,
  enterprise_id UUID,
  created_at TIMESTAMPTZ default NOW() not null,
  created_by UUID default auth.user_id (),
  updated_at TIMESTAMPTZ default NOW() not null,
  updated_by UUID default auth.user_id (),
  constraint uq_ent_notification_rule_name_enterprise unique (name, enterprise_id)
);

COMMENT on table notify.ent_notification_rule is 'Defines trigger conditions that automatically initiate notification workflows when specific events occur or schedules are met. Rules bind to workflows and generate notifications based on configurable trigger logic and payload processing.';

-- Req Ref: Single table approach for notification triggering, covers "Notification Record Management", "Message Publishing", "Retract Messages".
create table if not exists notify.ent_notification (
  id BIGINT generated always as identity primary key,
  name TEXT not null,
  description TEXT,
  publish_status shared_types.publish_status default 'DRAFT' not null,
  deactivated BOOLEAN default false not null,

  typ_notification_category_id BIGINT references notify.typ_notification_category (id) on delete set null,
  typ_notification_priority_id BIGINT references notify.typ_notification_priority (id) on delete set null,
  notification_workflow_id BIGINT references notify.ent_notification_workflow (id) on delete set null,
  notification_rule_id BIGINT references notify.ent_notification_rule (id) on delete set null, -- Null if manually triggered
  notification_status shared_types.notification_status default 'PENDING' not null,
  business_id UUID,

  -- Workflow selection
  -- Complete payload for Novu
  payload JSONB not null, -- Contains all data needed by the workflow
  -- Recipient configuration
  recipients UUID[] not null,
  -- Channel configuration (for dynamic workflows)
  channels shared_types.notification_channel_type[] default ARRAY['IN_APP']::shared_types.notification_channel_type[], -- Array of channel types
  -- Novu-specific configurations
  overrides JSONB, -- Novu API overrides
  -- Metadata and tracking
  tags TEXT[],

  -- Status tracking
  transaction_id TEXT, -- Filled after Novu trigger
  scheduled_for TIMESTAMPTZ, -- For delayed notifications
  processed_at TIMESTAMPTZ,
  retracted_at TIMESTAMPTZ, -- "Retract Erroneous Messages" (Timestamp when trigger was retracted)
  retraction_reason TEXT,
  error_details JSONB,

  workflow_version INTEGER default 1, -- Track workflow version used

  repr TEXT GENERATED ALWAYS as (func.normalize_repr (name)) STORED,

  enterprise_id UUID,
  created_at TIMESTAMPTZ default NOW() not null,
  created_by UUID default auth.user_id (),
  updated_at TIMESTAMPTZ default NOW() not null,
  updated_by UUID default auth.user_id (),
  constraint uq_ent_notification_name_enterprise unique (name, enterprise_id)
);

COMMENT on table notify.ent_notification is 'Records individual notification events triggered either by rules or manual actions. Tracks the complete lifecycle from creation through delivery, including payload data, recipient lists, delivery status, and retraction capabilities for message management.';

-- Indexes for performance
create index if not exists idx_ent_notification_created on notify.ent_notification (created_at DESC);