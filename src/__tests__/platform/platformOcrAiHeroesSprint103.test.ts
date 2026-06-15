import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildAiJobsListKpis, buildOcrJobsListKpis } from '@/lib/platform/platformListStats';
import { buildAiJobDetailKpis, buildOcrJobDetailKpis } from '@/lib/platform/platformDetailStats';
import { isPlatformLiveReady } from '@/lib/platform/platformModuleConfig';
import { getDemoAiJobs } from '@/data/demo/aiJobs';
import { getDemoOcrJobs } from '@/data/demo/ocrJobs';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Platform OCR/AI Heroes (Sprint 103)', () => {
  it('OcrJobsListHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/platform/OcrJobsListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(readSrc('src/components/platform/OcrJobsListView.tsx')).toContain('OcrJobsListHero');
  });

  it('AiJobsListHero und AiJobDetailHero nutzen PremiumListHeroFrame', () => {
    expect(readSrc('src/components/platform/AiJobsListHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('src/components/platform/AiJobDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('src/components/platform/AiJobsListView.tsx')).toContain('AiJobsListHero');
  });

  it('OcrJobDetailHero auf Detail-Screen', () => {
    expect(readSrc('src/screens/platform/OcrJobDetailScreen.tsx')).toContain('OcrJobDetailHero');
  });

  it('AiJob Detail Route und Hook existieren', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/business/platform/ai/[id]/index.tsx'))).toBe(true);
    expect(readSrc('src/hooks/useAiJobDetail.ts')).toContain('fetchAiJobDetail');
  });

  it('isPlatformLiveReady bleibt false', () => {
    expect(isPlatformLiveReady()).toBe(false);
  });

  it('buildOcrJobsListKpis zählt Jobs', () => {
    const kpis = buildOcrJobsListKpis(getDemoOcrJobs());
    expect(kpis[0]?.value).toBe('3');
  });

  it('buildAiJobsListKpis zählt Jobs', () => {
    const kpis = buildAiJobsListKpis(getDemoAiJobs());
    expect(kpis[0]?.value).toBe('2');
  });

  it('buildOcrJobDetailKpis liefert Konfidenz', () => {
    const job = getDemoOcrJobs()[0];
    if (!job) throw new Error('missing demo job');
    const kpis = buildOcrJobDetailKpis(job);
    expect(kpis[1]?.value).toContain('%');
  });

  it('buildAiJobDetailKpis liefert Job-Typ', () => {
    const job = getDemoAiJobs()[0];
    if (!job) throw new Error('missing demo job');
    const kpis = buildAiJobDetailKpis(job);
    expect(kpis[0]?.label).toBe('Job-Typ');
  });
});
