#!/usr/bin/env node
import { createAuditAdminClient, loadAuditEnv } from './scripts/audit/lib/auditSupabaseClient.mjs';

const env = loadAuditEnv();
const admin = createAuditAdminClient(env);
const threadId = 'c0e5c002-c002-4000-8000-000000000002';
const tenantId = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';

const threads = await admin.restSelect('office_message_threads', `id=eq.${threadId}&select=id,subject,status&limit=1`);
console.log('thread', threads);

const msgs = await admin.restSelect('office_messages', `thread_id=eq.${threadId}&select=id,body,created_at&limit=3`);
console.log('messages', msgs);
