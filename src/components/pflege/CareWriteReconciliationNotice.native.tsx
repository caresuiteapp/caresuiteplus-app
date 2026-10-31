// Generated native presentation from src/components/pflege/CareWriteReconciliationNotice.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { formatTime } from '@/lib/formatters/dateTimeFormatters';
import type { RoleKey } from '@/types';
import { reconcileCareStopWrite } from '@/lib/pflege/careStopWriteReconciliationService';
import { decodeCareStopWriteReconciliation, type CareStopWriteReconciliation, type CareStopWriteReconciliationRequest } from '@/lib/pflege/careStopWriteReconciliationDomain';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
type Props = {
    tenantId: string;
    role?: RoleKey | null;
    request: CareStopWriteReconciliationRequest;
    disabled?: boolean;
    onConfirmed: (receipt: CareStopWriteReconciliation) => void | Promise<void>;
};
type Frame = Props & {
    alive: boolean;
    busy: boolean;
    terminal: boolean;
    serial: number;
    snapshot: CareStopWriteReconciliationRequest | null;
};
type State = {
    frame: Frame;
    busy: boolean;
    receipt: CareStopWriteReconciliation | null;
    error: string;
};
const empty = (frame: Frame): State => ({ frame, busy: false, receipt: null, error: '' });
/** An old response may confirm only its unchanged, still mounted original request. */
export function CareWriteReconciliationNotice(props: Props) {
    const { c } = useCareLightPalette(), reference = useRef<Frame | null>(null);
    const previous = reference.current;
    if (!previous || previous.tenantId !== props.tenantId || previous.role !== props.role || previous.request !== props.request
        || previous.disabled !== props.disabled || previous.onConfirmed !== props.onConfirmed) {
        if (previous) {
            previous.alive = false;
            previous.serial++;
        }
        let snapshot: CareStopWriteReconciliationRequest | null = null;
        try {
            snapshot = freezeClientNativeOriginal(cloneClientNativeOriginal(props.request));
        }
        catch { /* No inferred request. */ }
        reference.current = { ...props, snapshot, alive: false, busy: false, terminal: false, serial: 0 };
    }
    const frame = reference.current!;
    const [state, setState] = useState<State>(() => empty(frame));
    const shown = state.frame === frame ? state : empty(frame);
    const current = () => {
        try {
            return reference.current === frame && frame.alive && !frame.disabled && !!frame.snapshot
                && sameClientNativeOriginal(cloneClientNativeOriginal(frame.request), frame.snapshot);
        }
        catch {
            return false;
        }
    };
    useEffect(() => {
        frame.alive = true;
        frame.busy = false;
        frame.terminal = false;
        frame.serial++;
        setState(empty(frame));
        return () => { frame.alive = false; frame.busy = false; frame.serial++; };
    }, [frame]);
    async function check() {
        if (!current() || frame.busy || frame.terminal)
            return;
        frame.busy = true;
        const ticket = ++frame.serial, request = frame.snapshot!;
        setState({ ...empty(frame), busy: true });
        try {
            const r = await reconcileCareStopWrite(frame.tenantId, frame.role, request);
            if (!current() || frame.serial !== ticket)
                return;
            if (!r.ok) {
                setState({ ...empty(frame), error: r.error });
                return;
            }
            const receipt = decodeCareStopWriteReconciliation(r.data, request);
            frame.terminal = receipt.state === 'confirmed' || receipt.state === 'conflict';
            setState({ frame, busy: false, receipt, error: '' });
            if (receipt.state === 'confirmed' && current() && frame.serial === ticket)
                await frame.onConfirmed(receipt);
        }
        catch {
            if (current() && frame.serial === ticket)
                setState(value => value.frame === frame
                    ? { ...value, busy: false, error: frame.terminal
                            ? 'Das Original ist bestätigt. Die Ansicht konnte nicht aktualisiert werden. Bitte neu laden.'
                            : 'Der Serverabgleich ist nicht bestätigt. Die ursprüngliche Anfrage bleibt erhalten.' } : value);
        }
        finally {
            if (current() && frame.serial === ticket) {
                frame.busy = false;
                setState(value => value.frame === frame ? { ...value, busy: false } : value);
            }
        }
    }
    const receipt = shown.receipt;
    return <View style={{ gap: 8, paddingVertical: 8 }}>
    <Text selectable style={{ color: c.text, fontWeight: '700' }}>Ungeklärte Anfrage: {frame.snapshot?.requestId ?? 'nicht bestätigt'}</Text>
    <Text style={{ color: c.muted }}>Der Abgleich ist rein lesend. Er sendet die Leistung nicht erneut und bestätigt nur die unveränderte Anfrage.</Text>
    {shown.error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{shown.error}</Text> : null}
    {receipt ? <Text accessibilityRole="alert" style={{ color: receipt.state === 'confirmed' ? c.green : receipt.state === 'conflict' ? c.danger : c.warning }}>{receipt.message} · geprüft {formatTime(receipt.serverCheckedAt)}</Text> : null}
    <PremiumButton variant="secondary" title="Originalanfrage am Server abgleichen" disabled={shown.busy || frame.disabled || !current() || frame.terminal} loading={shown.busy} onPress={() => void check()}/>
    {receipt?.state === 'not_found' ? <Text style={{ color: c.warning }}>Keinen neuen Vorgang anlegen. Falls erneut gesendet wird, ausschließlich die bereits eingefrorene Anfrage mit derselben Anfrage-ID und denselben Nutzdaten verwenden.</Text> : null}
    {receipt?.state === 'conflict' ? <Text style={{ color: c.danger, fontWeight: '700' }}>Konflikt gesperrt: nicht erneut senden; fachlich und technisch klären.</Text> : null}
  </View>;
}
