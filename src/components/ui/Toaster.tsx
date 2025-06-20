import { Toaster as HotToaster } from 'react-hot-toast';
import { toast as hotToast } from 'react-hot-toast';

export const Toaster = () => {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#333',
          color: '#fff',
        },
        success: {
          duration: 3000,
          style: {
            background: '#22c55e',
            color: '#fff',
          },
        },
        error: {
          duration: 4000,
          style: {
            background: '#ef4444',
            color: '#fff',
          },
        },
      }}
    />
  );
};

interface ToastFunction {
  (message: string, type?: 'success' | 'error' | 'warning'): void;
  success(message: string): void;
  error(message: string): void;
}

export function useToast() {
  const toast: ToastFunction = (message: string, type?: 'success' | 'error' | 'warning') => {
    if (type === 'success') {
      hotToast.success(message);
    } else if (type === 'error') {
      hotToast.error(message);
    } else if (type === 'warning') {
      hotToast(message);
    } else {
      hotToast(message);
    }
  };

  toast.success = hotToast.success;
  toast.error = hotToast.error;

  return { toast };
} 