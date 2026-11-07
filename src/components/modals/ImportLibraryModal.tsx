import React, { useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { openImportPlaylistDialog } from '../common/ImportPlaylistDialog';

/**
 * Old "Importa tu música" entry point (useUIStore.openImportModal): it now opens the single
 * "Importar playlist" dialog (components/common/ImportPlaylistDialog), so every import looks and
 * works the same.
 */
export const ImportLibraryModal: React.FC = () => {
  const { isImportModalOpen, closeImportModal } = useUIStore();
  useEffect(() => {
    if (!isImportModalOpen) return;
    closeImportModal();
    openImportPlaylistDialog();
  }, [isImportModalOpen, closeImportModal]);
  return null;
};
