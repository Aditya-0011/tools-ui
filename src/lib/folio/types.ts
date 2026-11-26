import { z } from "zod";

export const MAX_NOTE_BYTES = 1048576;
export const MAX_TITLE_LENGTH = 120;
export const MAX_FOLDER_LENGTH = 255;
export const MAX_FOLDER_DEPTH = 10;
export const MAX_SEGMENT_LENGTH = 64;

export const NoteSummarySchema = z.object({
  id: z.number(),
  folder: z.string().default(""),
  title: z.string().default(""),
  size: z.number().default(0),
  version: z.number().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type NoteSummary = z.infer<typeof NoteSummarySchema>;

export const NoteQuotaSchema = z.object({
  max_notes: z.number().default(0),
  max_bytes: z.number().default(0),
  used_notes: z.number().default(0),
  used_bytes: z.number().default(0),
});
export type NoteQuota = z.infer<typeof NoteQuotaSchema>;

export const ListNotesResponseSchema = z.object({
  notes: z.array(NoteSummarySchema).default([]),
  quota: NoteQuotaSchema.default({
    max_notes: 0,
    max_bytes: 0,
    used_notes: 0,
    used_bytes: 0,
  }),
});
export type NotesList = z.infer<typeof ListNotesResponseSchema>;

export const NoteLockSchema = z.object({
  editor_id: z.string().default(""),
  editor_label: z.string().default(""),
  locked_at: z.string().optional(),
  expires_at: z.string().optional(),
});
export type NoteLock = z.infer<typeof NoteLockSchema>;

export const NoteSchema = z.object({
  summary: NoteSummarySchema,
  content: z.string().default(""),
  lock: NoteLockSchema.optional(),
});
export type Note = z.infer<typeof NoteSchema>;

export const LockNoteResponseSchema = z.object({
  acquired: z.boolean().default(false),
  lock: NoteLockSchema.optional(),
  version: z.number().default(0),
});
export type LockNoteResponse = z.infer<typeof LockNoteResponseSchema>;

export type CreateNoteRequest = {
  folder: string;
  title: string;
  content: string;
};

export type RenameNoteRequest = {
  id: number;
  folder: string;
  title: string;
  editor_id?: string;
};

export type DeleteNoteRequest = { id: number; editor_id?: string };

export type MoveFolderRequest = { from_folder: string; to_folder: string };

export type DeleteFolderRequest = { folder: string };

export type SaveNoteRequest = {
  id: number;
  editor_id: string;
  version: number;
  content: string;
};

export type LockNoteRequest = {
  id: number;
  editor_id: string;
  editor_label: string;
  take_over: boolean;
};

export type ReleaseNoteRequest = { id: number; editor_id: string };

export type SimpleResponse = { message?: string };

export type NoteContent = {
  id: number;
  version: number;
  content: string;
};
