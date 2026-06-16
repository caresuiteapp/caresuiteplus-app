import { ReactNode } from 'react';
import { ListDetailLayout } from '@/components/layout/ListDetailLayout';

type AdaptiveListDetailProps = {
  list: ReactNode;
  detail: ReactNode;
  detailPlaceholder?: ReactNode;
  showDetail?: boolean;
};

/**
 * Phone: list only (detail via stack navigation).
 * Tablet/Desktop: vertical list-detail (list on top, detail below).
 */
export function AdaptiveListDetail({
  list,
  detail,
  detailPlaceholder,
  showDetail,
}: AdaptiveListDetailProps) {
  return (
    <ListDetailLayout
      list={list}
      detail={detail}
      detailPlaceholder={detailPlaceholder}
      showDetail={showDetail}
    />
  );
}
