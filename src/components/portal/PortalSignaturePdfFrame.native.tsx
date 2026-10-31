// Generated native presentation from src/components/portal/PortalSignaturePdfFrame.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeIframe} from '@/components/layout/NativeWorkspaceElements.native';
type Props = {
    title: string;
    url: string;
    height: number;
};
export function PortalSignaturePdfFrame({ title, url, height }: Props) {
    return <NativeIframe title={title} src={url} style={{ width: '100%', height, border: 'none', backgroundColor: '#fff' }}/>;
}
