// Utilitário para detectar tipo de conexão e ajustar timeouts

export const getConnectionType = (): 'wifi' | '4g' | '3g' | 'slow' | 'unknown' => {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number };
    mozConnection?: { effectiveType?: string; downlink?: number };
    webkitConnection?: { effectiveType?: string; downlink?: number };
  };
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  
  if (!connection) {
    return 'unknown';
  }
  
  const effectiveType = connection.effectiveType;
  const downlink = connection.downlink;
  
  // Detectar tipo de conexão
  if (effectiveType === '4g' && downlink > 1.5) {
    return '4g';
  } else if (effectiveType === '4g' && downlink <= 1.5) {
    return 'slow';
  } else if (effectiveType === '3g') {
    return '3g';
  } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  } else {
    return 'unknown';
  }
};

export const getOptimalTimeout = (): number => {
  const connectionType = getConnectionType();
  
  switch (connectionType) {
    case 'wifi':
      return 10000; // 10 segundos
    case '4g':
      return 20000; // 20 segundos
    case '3g':
      return 30000; // 30 segundos
    case 'slow':
      return 45000; // 45 segundos
    default:
      return 25000; // 25 segundos (padrão)
  }
};

export const getOptimalRetries = (): number => {
  const connectionType = getConnectionType();
  
  switch (connectionType) {
    case 'wifi':
      return 3;
    case '4g':
      return 5;
    case '3g':
      return 7;
    case 'slow':
      return 10;
    default:
      return 5;
  }
};

export const getConnectionInfo = () => {
  const connectionType = getConnectionType();
  const timeout = getOptimalTimeout();
  const retries = getOptimalRetries();
  
  return {
    type: connectionType,
    timeout,
    retries,
    isSlow: connectionType === 'slow' || connectionType === '3g'
  };
};
