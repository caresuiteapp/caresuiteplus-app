import { useCallback, useEffect, useMemo, useState } from 'react';

import {

  Modal,

  Platform,

  Pressable,

  StyleSheet,

  View,

  useWindowDimensions,

} from 'react-native';

import { EmployeeDetailSummaryPanel } from './EmployeeDetailSummaryPanel';

import { EmployeeSectionEditModal } from './EmployeeSectionEditModal';

import { useSectionEditModal } from '@/hooks/useSectionEditModal';

import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';

import { EmployeeOffboardingModal } from './employeeoffboardingmodal';

import { GradientModalHeader } from '@/components/layout/platform';
import { AutoScrollView } from '@/components/layout/AutoScrollView';

import { GlassSurface } from '@/components/ui/effects';

import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';

import { careRadius } from '@/design/tokens/radius';

import { moduleColor } from '@/design/tokens/modules';

import { EmployeePersonnelFilePanel } from '@/components/office/EmployeePersonnelFilePanel';

import { spacing } from '@/theme';



type EmployeeDetailModalProps = {

  visible: boolean;

  employeeId: string | null;

  onClose: () => void;

  onDeleted?: () => void;

  /** Opens edit modal immediately (e.g. deep link ?edit=1). */

  initialEditOpen?: boolean;

};



type ModalMode = 'preview' | 'personnel';



const PREVIEW_MAX_WIDTH = 920;

const PREVIEW_MIN_WIDTH = 560;

const FULL_MAX_WIDTH = 1280;



export function EmployeeDetailModal({

  visible,

  employeeId,

  onClose,

  onDeleted,

  initialEditOpen = false,

}: EmployeeDetailModalProps) {

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const { isDark } = useCareLightPalette();

  const officeAccent = moduleColor('office');

  const [mode, setMode] = useState<ModalMode>('preview');

  const sectionEdit = useSectionEditModal<EmployeeEditSectionKey>();

  const [offboardingOpen, setOffboardingOpen] = useState(false);

  const [detailRevision, setDetailRevision] = useState(0);



  useEffect(() => {

    if (!visible) {

      setMode('preview');

      sectionEdit.closeSection();

      setOffboardingOpen(false);

    }

  }, [visible]);



  useEffect(() => {

    if (visible && initialEditOpen) {

      sectionEdit.openSection('stammdaten');

    }

  }, [visible, initialEditOpen]);



  useEffect(() => {

    if (Platform.OS !== 'web' || !visible) return;

    const prev = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {

      document.body.style.overflow = prev;

    };

  }, [visible]);



  useEffect(() => {

    setMode('preview');

    sectionEdit.closeSection();

    setOffboardingOpen(false);

  }, [employeeId]);



  const isPersonnel = mode === 'personnel';



  const sheetWidth = useMemo(() => {

    if (isPersonnel) {

      return Math.min(

        screenWidth - spacing.md * 2,

        Math.max(PREVIEW_MIN_WIDTH, Math.min(FULL_MAX_WIDTH, screenWidth * 0.96)),

      );

    }

    return Math.min(

      screenWidth - spacing.lg * 2,

      Math.max(PREVIEW_MIN_WIDTH, Math.min(PREVIEW_MAX_WIDTH, screenWidth * 0.92)),

    );

  }, [isPersonnel, screenWidth]);



  const sheetMaxHeight = useMemo(

    () =>

      isPersonnel

        ? Math.min(screenHeight * 0.94, screenHeight - spacing.md * 2)

        : Math.min(screenHeight * 0.9, screenHeight - spacing.lg * 2),

    [isPersonnel, screenHeight],

  );



  const handleOpenPersonnelRecord = useCallback(() => {

    setMode('personnel');

  }, []);



  const handleBackToPreview = useCallback(() => {

    setMode('preview');

  }, []);



  const handleDeleted = useCallback(() => {

    onDeleted?.();

    onClose();

  }, [onClose, onDeleted]);



  const styles = useMemo(

    () =>

      StyleSheet.create({

        backdrop: {

          flex: 1,

          backgroundColor: careSuiteModalScrimStrong,

          justifyContent: 'center',

          alignItems: 'center',

          padding: isPersonnel ? spacing.md : spacing.lg,

        },

        sheetHost: {

          width: sheetWidth,

          maxHeight: sheetMaxHeight,

          minHeight: 0,

          minWidth: 0,

          flex: isPersonnel ? 1 : undefined,

          ...Platform.select({

            web: { boxShadow: '0 24px 64px rgba(0,0,0,0.35)' as unknown as undefined },

            default: {},

          }),

        },

        sheetInner: {

          flex: 1,

          minHeight: 0,

          minWidth: 0,

        },

        scroll: {

          flex: 1,

        },

        scrollContent: {

          flexGrow: 1,

        },

        fullContent: {

          flex: 1,

          minHeight: 0,

        },

      }),

    [isDark, isPersonnel, sheetMaxHeight, sheetWidth],

  );



  if (!employeeId) return null;



  return (

    <>

      <Modal

      visible={visible}

      transparent

      animationType="fade"

      onRequestClose={onClose}

      statusBarTranslucent

    >

      <View style={styles.backdrop} accessibilityViewIsModal>

        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />

        <View style={styles.sheetHost} pointerEvents="box-none">

          <GlassSurface

            radius={careRadius.lg}

            glowColor={officeAccent}

            glowOpacity={isDark ? 0.22 : 0.12}

            elevated

            style={styles.sheetInner}

          >

            <GradientModalHeader

              title={isPersonnel ? 'Personalakte' : 'Mitarbeitendenakte'}

              onBack={isPersonnel ? handleBackToPreview : undefined}

              onClose={onClose}

            />



            {isPersonnel ? (

              <View style={styles.fullContent}>

                <AutoScrollView

                  style={styles.scroll}

                  contentContainerStyle={styles.scrollContent}

                  fillViewport={false}

                >

                  <EmployeePersonnelFilePanel

                    key={`personnel-${detailRevision}`}

                    employeeId={employeeId}

                    embedded

                    embeddedInModal

                    onDeleted={handleDeleted}

                    onEditMasterData={() => sectionEdit.openSection('stammdaten')}

                    onOpenOffboarding={() => setOffboardingOpen(true)}

                  />

                </AutoScrollView>

              </View>

            ) : (

              <AutoScrollView

                style={styles.scroll}

                contentContainerStyle={styles.scrollContent}

                fillViewport={false}

              >

                <EmployeeDetailSummaryPanel

                  key={detailRevision}

                  employeeId={employeeId}

                  onOpenFullRecord={handleOpenPersonnelRecord}

                  onEditMasterData={() => sectionEdit.openSection('stammdaten')}

                  onOpenOffboarding={() => setOffboardingOpen(true)}

                  onDeleted={handleDeleted}

                />

              </AutoScrollView>

            )}

          </GlassSurface>

        </View>

      </View>

    </Modal>



      {sectionEdit.activeSection ? (

        <EmployeeSectionEditModal

          visible={sectionEdit.isOpen}

          employeeId={employeeId}

          section={sectionEdit.activeSection}

          onClose={sectionEdit.closeSection}

          onUpdated={() => {

            sectionEdit.closeSection();

            setDetailRevision((value) => value + 1);

          }}

          onOpenPersonnelRecord={() => {

            sectionEdit.closeSection();

            handleOpenPersonnelRecord();

          }}

        />

      ) : null}



      <EmployeeOffboardingModal

        visible={offboardingOpen}

        employeeId={employeeId}

        onClose={() => setOffboardingOpen(false)}

      />

    </>

  );

}
