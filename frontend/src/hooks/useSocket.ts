import { useContext } from 'react';
import { SocketContext } from '../contexts/SocketContext';

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket debe usarse dentro de un SocketProvider');
  }
  return context;
}