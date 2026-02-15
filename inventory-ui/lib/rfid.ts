import { registerPlugin } from '@capacitor/core';

export interface RFIDTag {
  epc: string;
  rssi?: number;
  count?: number;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export interface RFIDReadResult {
  tags: RFIDTag[];
  success: boolean;
  error?: string;
}

// Define the RFID plugin interface
export interface RFIDReaderPlugin {
  test?(): Promise<{ message: string }>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  getScanResults(): Promise<RFIDReadResult>;
  addListener(eventName: 'rfidTagRead', listenerFunc: (data: RFIDTag) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

class RFIDReaderWeb implements RFIDReaderPlugin {
  async test(): Promise<{ message: string }> {
    return { message: 'Web platform - RFID not available' };
  }

  async startScan(): Promise<void> {
    console.log('RFID scanning not available on web');
    throw new Error('RFID not available on web platform');
  }

  async stopScan(): Promise<void> {
    console.log('RFID scanning not available on web');
  }

  async getScanResults(): Promise<RFIDReadResult> {
    return {
      tags: [],
      success: false,
      error: 'RFID not available on web platform'
    };
  }

  async addListener(_eventName: string, _listenerFunc: (data: RFIDTag) => void): Promise<any> {
    return Promise.resolve();
  }

  async removeAllListeners(): Promise<void> {
    return Promise.resolve();
  }
}

// Register plugin with proper fallback
export const RFIDReader = registerPlugin<RFIDReaderPlugin>('RFIDReaderPlugin', {
  web: () => new RFIDReaderWeb(),
});
