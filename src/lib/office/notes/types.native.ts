// Generated native presentation from src/lib/office/notes/types.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
export type NoteCategory = 'general' | 'contacts' | 'dates' | 'knowledge' | 'sources' | 'tasks' | 'decisions' | 'next_steps' | 'ideas' | 'reflections' | 'questions';
export type NoteFormat = 'plain' | 'cornell' | 'mindmap' | 'handwriting';
export type NoteStatus = 'open' | 'in_progress' | 'done';
export type NoteField = {
    id: string;
    label: string;
    value: string;
};
export type NoteTask = {
    id: string;
    text: string;
    status: NoteStatus;
    assignee: string;
    dueDate: string;
};
export type NoteSource = {
    id: string;
    title: string;
    url: string;
};
export type MindMapNode = {
    id: string;
    parentId: string | null;
    text: string;
    x: number;
    y: number;
};
export type NoteStroke = {
    id: string;
    color: string;
    width: number;
    points: [
        number,
        number
    ][];
};
export type NoteContent = {
    text: string;
    cues: string;
    summary: string;
    fields: NoteField[];
    tasks: NoteTask[];
    sources: NoteSource[];
    nodes: MindMapNode[];
    strokes: NoteStroke[];
};
export type NoteDraft = {
    title: string;
    category: NoteCategory;
    format: NoteFormat;
    status: NoteStatus;
    tags: string[];
    dueDate: string;
    pinned: boolean;
    content: NoteContent;
};
export type OfficeNote = NoteDraft & {
    id: string;
    tenantId: string;
    ownerUserId: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
};
export type NotesActor = {
    tenantId: string;
    userId: string;
    roleKey: RoleKey | null | undefined;
    permissions?: readonly PermissionKey[];
};
export type NotesResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    conflict?: boolean;
    uncertain?: boolean;
};
export type NoteSaveOperation = {
    id: string;
    expectedRevision: number | null;
    draft: NoteDraft;
};
