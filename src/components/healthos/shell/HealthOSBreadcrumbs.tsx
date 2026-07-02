import { BreadcrumbBar, type BreadcrumbSegment } from '@/components/layout/platform/breadcrumbbar';

type Props = {
  segments: BreadcrumbSegment[];
  testID?: string;
};

/** Thin HealthOS wrapper around existing BreadcrumbBar — no route logic. */
export function HealthOSBreadcrumbs({ segments, testID = 'healthos-breadcrumbs' }: Props) {
  return <BreadcrumbBar segments={segments} />;
}

export type { BreadcrumbSegment };
