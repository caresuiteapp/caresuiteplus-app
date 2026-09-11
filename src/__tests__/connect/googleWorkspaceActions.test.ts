import { describe, expect, it } from 'vitest';
import { ACTIONS, validateWorkspaceAction } from '../../../supabase/functions/_shared/googleWorkspaceActions';
import { driveQuery, encodeMail, googleLink, plainMail, workspaceTab } from '@/lib/googleWorkspace/workspaceModel';

describe('Google Workspace requests', () => {
  it.each(['gmail_read','gmail_metadata','gmail_modify','calendar_update','calendar_delete','tasks_update','docs_batch_update','slides_batch_update'])('%s rejects missing resource IDs', action => {
    expect(() => validateWorkspaceAction(action, {})).toThrow();
  });
  it('preserves arbitrary binary upload bytes in a multipart request', () => {
    const bytes = Uint8Array.from([0, 255, 128, 13, 10, 1, 240]);
    const base64 = btoa(String.fromCharCode(...bytes));
    const request = ACTIONS.drive_upload.build({ name: 'Prüfung.png', mimeType: 'image/png', base64 });
    const body = request.body as Uint8Array;
    expect(body).toBeInstanceOf(Uint8Array);
    const marker = new TextEncoder().encode('Content-Type: image/png\r\n\r\n');
    const binary = String.fromCharCode(...body); const offset = binary.indexOf(String.fromCharCode(...marker)) + marker.length;
    expect(Array.from(body.slice(offset, offset + bytes.length))).toEqual(Array.from(bytes));
    expect(new TextDecoder().decode(body)).toContain('Prüfung.png');
  });
  it('rejects upload header injection and files over 5 MB', () => {
    expect(() => validateWorkspaceAction('drive_upload', {name:'x',mimeType:'text/plain\r\nEvil: yes',base64:'eA=='})).toThrow();
    expect(() => ACTIONS.drive_upload.build({name:'x',mimeType:'text/plain',base64:btoa('a'.repeat(5 * 1024 * 1024 + 1))})).toThrow('5 MB');
  });
  it('uses PATCH to complete a task in the selected list', () => {
    const action = ACTIONS.tasks_update; const request = action.build({taskListId:'a/b',id:'c/d',task:{status:'completed'}});
    expect(action.method).toBe('PATCH'); expect(request.url).toContain('/lists/a%2Fb/tasks/c%2Fd'); expect(request.body).toEqual({status:'completed'});
  });
  it('paginates both task lists and tasks including completed hidden entries', () => {
    expect(ACTIONS.tasks_lists.build({pageToken:'next token'}).url).toContain('pageToken=next+token');
    const url = new URL(ACTIONS.tasks_list.build({showCompleted:true,pageToken:'next'}).url);
    expect(url.searchParams.get('showHidden')).toBe('true'); expect(url.searchParams.get('pageToken')).toBe('next');
  });
  it('clamps invalid page sizes and sorts recent Drive files', () => {
    expect(new URL(ACTIONS.drive_list.build({limit:-5}).url).searchParams.get('pageSize')).toBe('1');
    expect(new URL(ACTIONS.drive_list.build({}).url).searchParams.get('orderBy')).toBe('modifiedTime desc');
  });
  it('rejects invalid event intervals before writing to Google', () => {
    expect(() => validateWorkspaceAction('calendar_create', {event:{summary:'A',start:{dateTime:'2026-09-11T12:00:00Z'},end:{dateTime:'2026-09-11T11:00:00Z'}}})).toThrow();
    expect(() => validateWorkspaceAction('calendar_create', {event:{summary:'A',start:{dateTime:'2026-09-11T12:00:00Z'},end:{dateTime:'2026-09-11T13:00:00Z'}}})).not.toThrow();
  });
  it('restricts chat destinations to space resource names', () => {
    expect(() => validateWorkspaceAction('chat_send',{space:'spaces/a?key=bad'})).toThrow();
    expect(() => validateWorkspaceAction('chat_send',{space:'spaces/abc_123'})).not.toThrow();
  });
});
describe('Google Workspace presentation data', () => {
  it('escapes Drive search strings without altering the service filter', () => {
    expect(driveQuery('docs', "O'Brian\\2026")).toBe("trashed = false and mimeType = 'application/vnd.google-apps.document' and name contains 'O\\'Brian\\\\2026'");
  });
  it('encodes German email content without losing Unicode', () => {
    const raw = encodeMail('person@example.com','Prüfung ✓','Grüße aus Köln');
    const decoded = atob(raw.replace(/-/g,'+').replace(/_/g,'/'));
    const content = decoded.split('\r\n\r\n')[1];
    expect(new TextDecoder().decode(Uint8Array.from(atob(content), c => c.charCodeAt(0)))).toBe('Grüße aus Köln');
  });
  it.each([['bad\r\nBcc: victim@example.com','Titel'],['person@example.com','Titel\nBcc: victim@example.com'],['not-an-email','Titel']])('rejects email header injection and malformed recipient %s', (to, subject) => {
    expect(() => encodeMail(to,subject,'Text')).toThrow();
  });
  it('extracts nested plain text without rendering HTML messages', () => {
    expect(plainMail({parts:[{mimeType:'text/html',body:{data:btoa('<script>alert(1)</script>')}},{mimeType:'text/plain',body:{data:btoa('Plain message')}}]})).toBe('Plain message');
    expect(plainMail({mimeType:'text/html',body:{data:btoa('HTML only')}})).toBe('');
  });
  it.each(['javascript:alert(1)','https://google.com.evil.test/path','https://evil.test','http://docs.google.com'])('rejects untrusted external links %s', url => { expect(googleLink(url)).toBeNull(); });
  it('accepts Google links and normalizes unknown service deep links', () => {
    expect(googleLink('https://docs.google.com/document/d/123/edit')).toContain('docs.google.com');
    expect(workspaceTab('tasks')).toBe('tasks'); expect(workspaceTab('unknown')).toBe('overview');
  });
});
