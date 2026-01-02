import { IdeaMetadata } from '../types/docflow';

export function getDeviceInfo(): IdeaMetadata {
  const ua = navigator.userAgent;
  
  // Detect browser
  let browser = 'Onbekend';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  // Detect OS
  let os = 'Onbekend';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Detect device type
  let device = 'Desktop';
  if (/Mobile|Android|iPhone/i.test(ua)) device = 'Mobiel';
  else if (/iPad|Tablet/i.test(ua)) device = 'Tablet';

  // Screen resolution
  const screenResolution = `${window.screen.width}x${window.screen.height}`;

  // Note: IP address moet server-side bepaald worden
  // Voor demo doeleinden gebruiken we een placeholder
  const ipAddress = 'Server-side bepalen';

  return {
    ipAddress,
    userAgent: ua,
    browser,
    os,
    device,
    screenResolution
  };
}

export function getClientIP(): Promise<string> {
  // In een echte app zou dit via de backend moeten
  // Voor nu retourneren we een placeholder
  return Promise.resolve('Niet beschikbaar (client-side)');
}
