import { Toaster as HotToaster } from 'react-hot-toast';
import { toast as hotToast } from 'react-hot-toast';

export const Toaster = () => {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '12px 20px',
          fontSize: '14px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      }}
      gutter={8}
      containerStyle={{
        top: 40,
        left: 40,
        bottom: 40,
        right: 40,
      }}
      containerClassName=""
      reverseOrder={false}
      limit={1}
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