import type { ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createInitialQmDemoStore,
  type QmDemoStore,
} from './qm.demoData';
import type {
  MdAccessLogEntry,
  MdAuditPackage,
  MdAuditPackageItem,
  MdShareToken,
  QmAiDraft,
  QmAudit,
  QmChange,
  QmComplianceRequirement,
  QmDocument,
  QmDocumentVersion,
  QmExportJob,
  QmHandbook,
  QmHandbookChapter,
  QmLegalReference,
  QmMeasure,
  QmReadConfirmation,
  QmTemplateSeed,
} from './qm.types';

let store: QmDemoStore = createInitialQmDemoStore();
let idCounter = 1000;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function now(): string {
  return new Date().toISOString();
}

function assertTenant(tenantId: string): ServiceResult<never> | null {
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Mandant nicht gefunden.' };
  }
  return null;
}

export function resetQmDemoStore(): void {
  store = createInitialQmDemoStore();
  idCounter = 1000;
}

export const qmDemoRepository = {
  getStore(): QmDemoStore {
    return store;
  },

  async getHandbook(tenantId: string): Promise<ServiceResult<QmHandbook>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: { ...store.handbook } };
  },

  async listChapters(tenantId: string): Promise<ServiceResult<QmHandbookChapter[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.chapters.map((c) => ({ ...c })) };
  },

  async getChapter(tenantId: string, id: string): Promise<ServiceResult<QmHandbookChapter | null>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const chapter = store.chapters.find((c) => c.id === id);
    return { ok: true, data: chapter ? { ...chapter } : null };
  },

  async createChapter(
    tenantId: string,
    input: Omit<QmHandbookChapter, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<QmHandbookChapter>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const chapter: QmHandbookChapter = {
      ...input,
      id: nextId('qm-ch'),
      tenantId,
      createdAt: now(),
      updatedAt: now(),
    };
    store.chapters.push(chapter);
    return { ok: true, data: { ...chapter } };
  },

  async updateChapter(
    tenantId: string,
    id: string,
    patch: Partial<Pick<QmHandbookChapter, 'title' | 'content' | 'status' | 'sortOrder'>>,
  ): Promise<ServiceResult<QmHandbookChapter>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const idx = store.chapters.findIndex((c) => c.id === id);
    if (idx < 0) return { ok: false, error: 'Kapitel nicht gefunden.' };
    store.chapters[idx] = { ...store.chapters[idx], ...patch, updatedAt: now() };
    return { ok: true, data: { ...store.chapters[idx] } };
  },

  async versionChapter(tenantId: string, id: string): Promise<ServiceResult<QmHandbookChapter>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const idx = store.chapters.findIndex((c) => c.id === id);
    if (idx < 0) return { ok: false, error: 'Kapitel nicht gefunden.' };
    const [major] = store.chapters[idx].version.split('.');
    const newVersion = `${major}.${Number(store.chapters[idx].version.split('.')[1] ?? 0) + 1}`;
    store.chapters[idx] = {
      ...store.chapters[idx],
      version: newVersion,
      status: 'draft',
      updatedAt: now(),
    };
    return { ok: true, data: { ...store.chapters[idx] } };
  },

  async listDocuments(tenantId: string): Promise<ServiceResult<QmDocument[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.documents.map((d) => ({ ...d })) };
  },

  async getDocument(tenantId: string, id: string): Promise<ServiceResult<QmDocument | null>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const doc = store.documents.find((d) => d.id === id);
    return { ok: true, data: doc ? { ...doc } : null };
  },

  async listDocumentVersions(tenantId: string, documentId: string): Promise<ServiceResult<QmDocumentVersion[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return {
      ok: true,
      data: store.documentVersions.filter((v) => v.documentId === documentId).map((v) => ({ ...v })),
    };
  },

  async approveDocument(tenantId: string, documentId: string, approvedBy: string): Promise<ServiceResult<QmDocument>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const idx = store.documents.findIndex((d) => d.id === documentId);
    if (idx < 0) return { ok: false, error: 'Dokument nicht gefunden.' };
    store.documents[idx] = { ...store.documents[idx], status: 'approved', updatedAt: now() };
    const vIdx = store.documentVersions.findIndex((v) => v.id === store.documents[idx].currentVersionId);
    if (vIdx >= 0) {
      store.documentVersions[vIdx] = {
        ...store.documentVersions[vIdx],
        status: 'approved',
        approvedAt: now(),
        approvedBy,
        updatedAt: now(),
      };
    }
    return { ok: true, data: { ...store.documents[idx] } };
  },

  async listLegalReferences(tenantId: string): Promise<ServiceResult<QmLegalReference[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.legalReferences.map((l) => ({ ...l })) };
  },

  async listCompliance(tenantId: string): Promise<ServiceResult<QmComplianceRequirement[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.compliance.map((c) => ({ ...c })) };
  },

  async listChanges(tenantId: string): Promise<ServiceResult<QmChange[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.changes.map((c) => ({ ...c })) };
  },

  async createChange(
    tenantId: string,
    input: Omit<QmChange, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<QmChange>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const change: QmChange = { ...input, id: nextId('qm-chg'), tenantId, createdAt: now(), updatedAt: now() };
    store.changes.unshift(change);
    return { ok: true, data: { ...change } };
  },

  async listAudits(tenantId: string): Promise<ServiceResult<QmAudit[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.audits.map((a) => ({ ...a })) };
  },

  async createAudit(
    tenantId: string,
    input: Omit<QmAudit, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<QmAudit>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const audit: QmAudit = { ...input, id: nextId('qm-aud'), tenantId, createdAt: now(), updatedAt: now() };
    store.audits.unshift(audit);
    return { ok: true, data: { ...audit } };
  },

  async listMeasures(tenantId: string): Promise<ServiceResult<QmMeasure[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.measures.map((m) => ({ ...m })) };
  },

  async createMeasure(
    tenantId: string,
    input: Omit<QmMeasure, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<QmMeasure>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const measure: QmMeasure = { ...input, id: nextId('qm-meas'), tenantId, createdAt: now(), updatedAt: now() };
    store.measures.unshift(measure);
    return { ok: true, data: { ...measure } };
  },

  async listMdPackages(tenantId: string): Promise<ServiceResult<MdAuditPackage[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.mdPackages.map((p) => ({ ...p })) };
  },

  async getMdPackage(tenantId: string, id: string): Promise<ServiceResult<MdAuditPackage | null>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const pkg = store.mdPackages.find((p) => p.id === id);
    return { ok: true, data: pkg ? { ...pkg } : null };
  },

  async listMdPackageItems(tenantId: string, packageId: string): Promise<ServiceResult<MdAuditPackageItem[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return {
      ok: true,
      data: store.mdPackageItems.filter((i) => i.packageId === packageId).map((i) => ({ ...i })),
    };
  },

  async createMdPackage(
    tenantId: string,
    input: Pick<MdAuditPackage, 'title' | 'inspectionYear' | 'notes'>,
  ): Promise<ServiceResult<MdAuditPackage>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const pkg: MdAuditPackage = {
      id: nextId('md-pkg'),
      tenantId,
      title: input.title,
      status: 'draft',
      inspectionYear: input.inspectionYear,
      datenschutzConfirmed: false,
      approvedAt: null,
      approvedBy: null,
      exportJobId: null,
      shareTokenId: null,
      notes: input.notes,
      createdAt: now(),
      updatedAt: now(),
    };
    store.mdPackages.unshift(pkg);
    return { ok: true, data: { ...pkg } };
  },

  async updateMdPackage(
    tenantId: string,
    id: string,
    patch: Partial<MdAuditPackage>,
  ): Promise<ServiceResult<MdAuditPackage>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const idx = store.mdPackages.findIndex((p) => p.id === id);
    if (idx < 0) return { ok: false, error: 'MD-Mappe nicht gefunden.' };
    store.mdPackages[idx] = { ...store.mdPackages[idx], ...patch, updatedAt: now() };
    return { ok: true, data: { ...store.mdPackages[idx] } };
  },

  async setMdPackageItems(
    tenantId: string,
    packageId: string,
    documentIds: string[],
  ): Promise<ServiceResult<MdAuditPackageItem[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    store.mdPackageItems = store.mdPackageItems.filter((i) => i.packageId !== packageId);
    const items: MdAuditPackageItem[] = documentIds.map((documentId, i) => {
      const doc = store.documents.find((d) => d.id === documentId);
      return {
        id: nextId('md-item'),
        tenantId,
        packageId,
        documentId,
        sortOrder: i + 1,
        includedVersionId: doc?.currentVersionId ?? null,
        notes: '',
        createdAt: now(),
        updatedAt: now(),
      };
    });
    store.mdPackageItems.push(...items);
    const pkgIdx = store.mdPackages.findIndex((p) => p.id === packageId);
    if (pkgIdx >= 0) {
      store.mdPackages[pkgIdx] = { ...store.mdPackages[pkgIdx], status: 'in_preparation', updatedAt: now() };
    }
    return { ok: true, data: items.map((item) => ({ ...item })) };
  },

  async createShareToken(
    tenantId: string,
    packageId: string,
    expiresInDays: number,
  ): Promise<ServiceResult<MdShareToken>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const tokenValue = `md-${Date.now()}-${idCounter}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    const token: MdShareToken = {
      id: nextId('md-token'),
      tenantId,
      packageId,
      token: tokenValue,
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      accessCount: 0,
      shareUrl: `/public/md-share/${tokenValue}`,
      createdAt: now(),
      updatedAt: now(),
    };
    store.mdShareTokens.push(token);
    const pkgIdx = store.mdPackages.findIndex((p) => p.id === packageId);
    if (pkgIdx >= 0) {
      store.mdPackages[pkgIdx] = {
        ...store.mdPackages[pkgIdx],
        shareTokenId: token.id,
        status: 'shared',
        updatedAt: now(),
      };
    }
    return { ok: true, data: { ...token } };
  },

  async revokeShareToken(tenantId: string, tokenId: string): Promise<ServiceResult<MdShareToken>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const idx = store.mdShareTokens.findIndex((t) => t.id === tokenId);
    if (idx < 0) return { ok: false, error: 'Token nicht gefunden.' };
    store.mdShareTokens[idx] = { ...store.mdShareTokens[idx], revokedAt: now(), updatedAt: now() };
    const pkgIdx = store.mdPackages.findIndex((p) => p.shareTokenId === tokenId);
    if (pkgIdx >= 0) {
      store.mdPackages[pkgIdx] = { ...store.mdPackages[pkgIdx], status: 'revoked', updatedAt: now() };
    }
    return { ok: true, data: { ...store.mdShareTokens[idx] } };
  },

  async getShareTokenByValue(token: string): Promise<ServiceResult<MdShareToken | null>> {
    const found = store.mdShareTokens.find((t) => t.token === token);
    return { ok: true, data: found ? { ...found } : null };
  },

  async logMdAccess(
    tenantId: string,
    entry: Omit<MdAccessLogEntry, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<MdAccessLogEntry>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const log: MdAccessLogEntry = { ...entry, id: nextId('md-log'), tenantId, createdAt: now(), updatedAt: now() };
    store.mdAccessLogs.unshift(log);
    if (entry.success) {
      const tIdx = store.mdShareTokens.findIndex((t) => t.id === entry.tokenId);
      if (tIdx >= 0) {
        store.mdShareTokens[tIdx] = {
          ...store.mdShareTokens[tIdx],
          accessCount: store.mdShareTokens[tIdx].accessCount + 1,
          updatedAt: now(),
        };
      }
    }
    return { ok: true, data: { ...log } };
  },

  async listMdAccessLogs(tenantId: string, packageId?: string): Promise<ServiceResult<MdAccessLogEntry[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    let logs = store.mdAccessLogs;
    if (packageId) logs = logs.filter((l) => l.packageId === packageId);
    return { ok: true, data: logs.map((l) => ({ ...l })) };
  },

  async listExportJobs(tenantId: string): Promise<ServiceResult<QmExportJob[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.exportJobs.map((j) => ({ ...j })) };
  },

  async createExportJob(
    tenantId: string,
    input: Pick<QmExportJob, 'packageId' | 'documentIds' | 'format'>,
  ): Promise<ServiceResult<QmExportJob>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const job: QmExportJob = {
      id: nextId('qm-export'),
      tenantId,
      packageId: input.packageId,
      documentIds: input.documentIds,
      status: 'in_preparation',
      format: input.format,
      preparedOnly: true,
      downloadUrl: null,
      errorMessage: null,
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    store.exportJobs.unshift(job);
    setTimeout(() => {
      const idx = store.exportJobs.findIndex((j) => j.id === job.id);
      if (idx >= 0) {
        store.exportJobs[idx] = {
          ...store.exportJobs[idx],
          status: 'generated',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }, 0);
    return { ok: true, data: { ...job } };
  },

  async listAiDrafts(tenantId: string): Promise<ServiceResult<QmAiDraft[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.aiDrafts.map((d) => ({ ...d })) };
  },

  async createAiDraft(
    tenantId: string,
    input: Omit<QmAiDraft, 'id' | 'tenantId' | 'status' | 'reviewedAt' | 'disclaimer' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<QmAiDraft>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const draft: QmAiDraft = {
      ...input,
      id: nextId('qm-ai'),
      tenantId,
      status: 'pending',
      disclaimer: 'KI-generierte Inhalte sind Vorschläge und müssen durch QMB/PDL geprüft werden.',
      reviewedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    store.aiDrafts.unshift(draft);
    return { ok: true, data: { ...draft } };
  },

  async updateAiDraft(
    tenantId: string,
    id: string,
    status: QmAiDraft['status'],
  ): Promise<ServiceResult<QmAiDraft>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    const idx = store.aiDrafts.findIndex((d) => d.id === id);
    if (idx < 0) return { ok: false, error: 'KI-Entwurf nicht gefunden.' };
    store.aiDrafts[idx] = {
      ...store.aiDrafts[idx],
      status,
      reviewedAt: now(),
      updatedAt: now(),
    };
    return { ok: true, data: { ...store.aiDrafts[idx] } };
  },

  async listReadConfirmations(tenantId: string, documentId: string): Promise<ServiceResult<QmReadConfirmation[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return {
      ok: true,
      data: store.readConfirmations.filter((r) => r.documentId === documentId).map((r) => ({ ...r })),
    };
  },

  async listTemplates(tenantId: string): Promise<ServiceResult<QmTemplateSeed[]>> {
    const err = assertTenant(tenantId);
    if (err) return err;
    return { ok: true, data: store.templates.map((t) => ({ ...t })) };
  },
};
