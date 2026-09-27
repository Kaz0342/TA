import api from './api';

export interface DeviceCommandData {
  command: 'AUTO' | 'PAUSE';
  is_paused: boolean;
  duration_seconds: number;
  remaining_seconds: number;
  paused_until: string | null;
  reason: string | null;
}

export const deviceControlService = {
  async getStatus(): Promise<DeviceCommandData> {
    const res = await api.get('/device/command');
    return res.data.data;
  },

  async pause(durationSeconds: number, reason: string = 'Mode Panen'): Promise<DeviceCommandData> {
    const res = await api.post('/device/pause', {
      duration_seconds: durationSeconds,
      reason,
    });
    return res.data.data;
  },

  async resume(): Promise<DeviceCommandData> {
    const res = await api.post('/device/resume');
    return res.data.data;
  },

  async activateMistingSystem(durationMinutes: number): Promise<void> {
    // Simulasi API call (delay 1 detik)
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[SIMULATION] Misting activated for ${durationMinutes} minutes`);
        resolve();
      }, 1000);
    });
  },
};
