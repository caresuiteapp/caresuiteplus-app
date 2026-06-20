export type ModalStackPayload = Record<string, unknown>;

export type ModalStackEntry = {
  id: string;
  title: string;
  subtitle?: string;
  maxWidth?: number;
  /** Registry key in MODULE_NAV_MODAL_SCREENS */
  modalKey?: string;
  payload?: ModalStackPayload;
};

export type OpenModalOptions = {
  title: string;
  subtitle?: string;
  modalKey?: string;
  maxWidth?: number;
  payload?: ModalStackPayload;
};

export type PushModalOptions = OpenModalOptions;
