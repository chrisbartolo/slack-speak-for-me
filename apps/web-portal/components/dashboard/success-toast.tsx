'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

type SuccessToastProps = {
  message: string;
  variant?: 'success' | 'error';
};

export function SuccessToast({ message, variant = 'success' }: SuccessToastProps) {
  useEffect(() => {
    if (variant === 'success') {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, [message, variant]);

  return null;
}
