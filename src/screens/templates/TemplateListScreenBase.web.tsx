import { TemplateListWorkspace } from '@/components/templates/TemplateWorkspace.web';
import type { TemplateListFilters } from '@/types/templates';
import type { TemplateListModuleHeroKey } from '@/components/templates';
export function TemplateListScreenBase(props:{title:string;subtitle:string;baseFilters?:TemplateListFilters;listHeroModule?:TemplateListModuleHeroKey;showCreate?:boolean;createRoute?:string}) { return <TemplateListWorkspace {...props}/>; }
export type {TemplateType} from '@/types/templates';
