export {};
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: { id?: number; first_name?: string; username?: string; photo_url?: string } };
        ready?: () => void;
        expand?: () => void;
        HapticFeedback?: { impactOccurred?: (style: string) => void; notificationOccurred?: (type: string) => void };
      };
    };
    __AUTOSYNDICATE_AUTHENTICATED__?: boolean;
  }
}
