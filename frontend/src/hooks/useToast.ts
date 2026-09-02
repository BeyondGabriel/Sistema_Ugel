import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return context;
}