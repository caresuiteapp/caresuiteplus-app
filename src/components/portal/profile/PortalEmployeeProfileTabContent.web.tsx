import type {ComponentProps} from 'react';
// Explicit base filename keeps the existing native component unchanged.
import {PortalEmployeeProfileTabContent as BaseContent} from './PortalEmployeeProfileTabContent.tsx';
import {GkvEmployeeSelf} from '@/components/office/gkv/GkvEmployees.web';

export function PortalEmployeeProfileTabContent(props:ComponentProps<typeof BaseContent>){
 return <><BaseContent {...props}/><GkvEmployeeSelf/></>;
}
