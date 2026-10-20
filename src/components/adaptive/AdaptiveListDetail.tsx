import { ReactNode } from 'react';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';

type AdaptiveListDetailProps = {
  list: ReactNode;
  detail: ReactNode;
  detailPlaceholder?: ReactNode;
  showDetail?: boolean;
};

/**
 * Phone: list only (detail via stack navigation).
 * Tablet/Desktop: master-detail split pane.
 */
export function AdaptiveListDetail({
  list,
  detail,
  detailPlaceholder,
  showDetail,
}: AdaptiveListDetailProps) {
  return (
    <MasterDetailLayout
      master={list}
      detail={detail}
      detailPlaceholder={detailPlaceholder}
      showDetail={showDetail}
    />
  );
}
