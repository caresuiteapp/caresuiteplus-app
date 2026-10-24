// Generated native presentation from src/features/beratung/ConsultationIcon.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import { WebActionIcon } from "../../components/icons/WebActionIcon.native.tsx";
const paths = {
    open: ['M7 3v4M17 3v4M4 10h16', 'M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'm9 15 2 2 4-4'],
    review: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z', 'M14 3v6h6M8 13h8M8 17h5'],
    returned: ['M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z', 'M8 9h8M8 13h5'],
    done: ['m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6Z', 'm8 12 3 3 5-6'],
} as const;
export function ConsultationIcon({ name }: {
    name: keyof typeof paths;
}) {
    return <WebActionIcon size={24}>{paths[name].map((d, i) => <NativeSvgPath key={i} d={d}/>)}</WebActionIcon>;
}
