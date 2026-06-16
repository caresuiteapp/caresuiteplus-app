import { ReactNode } from 'react';
import { ListDetailLayout } from './ListDetailLayout';

type MasterDetailLayoutProps = {
  master: ReactNode;
  detail: ReactNode;
  detailPlaceholder?: ReactNode;
  showDetail?: boolean;
};

/**
 * @deprecated Prefer ListDetailLayout — kept for backward compatibility.
 * Delegates to vertical ListDetailLayout (list on top, detail below).
 */
export function MasterDetailLayout({
  master,
  detail,
  detailPlaceholder,
  showDetail = true,
}: MasterDetailLayoutProps) {
  return (
    <ListDetailLayout
      list={master}
      detail={detail}
      detailPlaceholder={detailPlaceholder}
      showDetail={showDetail}
    />
  );
}

export { ListDetailLayout } from './ListDetailLayout';
export type { ListDetailLayoutProps } from './ListDetailLayout';
