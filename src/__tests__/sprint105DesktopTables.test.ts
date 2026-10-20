import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Platform Desktop Tables (Sprint 105)', () => {
  it('OcrJobsListView nutzt Desktop View-Toggle platform.ocr', () => {
    const source = readSrc('src/components/platform/OcrJobsListView.tsx');
    expect(source).toContain('OcrJobsListTable');
    expect(source).toContain("useDesktopListViewPreference('platform.ocr')");
    expect(readSrc('src/components/platform/OcrJobsListHero.tsx')).toContain('DesktopListViewToggle');
  });

  it('AiJobsListView nutzt Desktop View-Toggle platform.ai', () => {
    const source = readSrc('src/components/platform/AiJobsListView.tsx');
    expect(source).toContain('AiJobsListTable');
    expect(source).toContain("useDesktopListViewPreference('platform.ai')");
  });

  it('OcrJobsListTable hat Spalten Dokument und Status', () => {
    const source = readSrc('src/components/platform/OcrJobsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain("label: 'Dokument'");
  });
});

describe('Assist CareRecords Desktop Tables (Sprint 105)', () => {
  it('CareRecordsListView nutzt Persistenz assist.careRecords', () => {
    const source = readSrc('src/components/assist/CareRecordsListView.tsx');
    expect(source).toContain('CareRecordsListTable');
    expect(source).toContain("useDesktopListViewPreference('assist.careRecords')");
    expect(readSrc('src/screens/assist/CareRecordsListScreen.tsx')).toContain('CareRecordsListView');
  });

  it('CareRecordsListTable hat Spalten Einsatz und Signatur', () => {
    const source = readSrc('src/components/assist/CareRecordsListTable.tsx');
    expect(source).toContain("label: 'Einsatz'");
    expect(source).toContain("label: 'Signatur'");
  });
});

describe('Beratung Extension Desktop Tables (Sprint 105)', () => {
  it('ProtocolsListView nutzt beratung.protocols Persistenz', () => {
    const source = readSrc('src/components/beratung/ProtocolsListView.tsx');
    expect(source).toContain('ProtocolsListTable');
    expect(source).toContain("useDesktopListViewPreference('beratung.protocols')");
  });

  it('FollowUpsListView nutzt beratung.followUps Persistenz', () => {
    const source = readSrc('src/components/beratung/FollowUpsListView.tsx');
    expect(source).toContain('FollowUpsListTable');
    expect(source).toContain("useDesktopListViewPreference('beratung.followUps')");
  });
});

describe('Insight Data Sources Desktop Tables (Sprint 105)', () => {
  it('InsightDataSourcesListView nutzt insight.dataSources Persistenz', () => {
    const source = readSrc('src/components/insight/InsightDataSourcesListView.tsx');
    expect(source).toContain('InsightDataSourcesListTable');
    expect(source).toContain("useDesktopListViewPreference('insight.dataSources')");
    expect(readSrc('src/screens/insight/InsightDataSourcesListScreen.tsx')).toContain(
      'InsightDataSourcesListView',
    );
  });
});
