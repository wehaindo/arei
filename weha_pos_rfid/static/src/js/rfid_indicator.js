/** @odoo-module **/

import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { patch } from "@web/core/utils/patch";

patch(Navbar.prototype, {
    getRfidStatusClass() {
        const rfidService = this.env.services.rfid;
        if (!rfidService) return 'rfid-disconnected';
        
        if (rfidService.isConnected) {
            return 'rfid-connected';
        } else if (rfidService.isConnecting) {
            return 'rfid-connecting';
        } else {
            return 'rfid-disconnected';
        }
    },
    
    getRfidStatusIcon() {
        const rfidService = this.env.services.rfid;
        if (!rfidService) return 'fa fa-wifi text-danger';
        
        if (rfidService.isConnected) {
            return 'fa fa-wifi text-success';
        } else if (rfidService.isConnecting) {
            return 'fa fa-spinner fa-spin text-warning';
        } else {
            return 'fa fa-wifi text-danger';
        }
    },
    
    getRfidStatusText() {
        const rfidService = this.env.services.rfid;
        if (!rfidService) return 'RFID: Error';
        
        const cachedCount = rfidService.cachedLotsCount || 0;
        const syncTime = rfidService.lastSyncTime;
        const timeStr = syncTime ? ` (${syncTime.toLocaleTimeString()})` : '';
        
        if (rfidService.isConnected) {
            return `RFID: Connected | ${cachedCount} items cached${timeStr}`;
        } else if (rfidService.isConnecting) {
            return `RFID: Connecting... | ${cachedCount} items cached`;
        } else {
            return `RFID: Disconnected | ${cachedCount} items cached`;
        }
    },
    
    async onRfidClick() {
        const rfidService = this.env.services.rfid;
        if (!rfidService) {
            this.notification.add('RFID service not available', {
                type: 'danger'
            });
            return;
        }
        
        // Long press (hold for sync) or right-click = sync stock
        // Normal click = connect/reconnect RFID
        const syncStock = async () => {
            await rfidService.syncLotStock();
        };
        
        // For now, always sync on click (stock sync works independently)
        // If disconnected, also attempt to reconnect
        if (!rfidService.isConnected && !rfidService.isConnecting) {
            // Try to reconnect RFID
            rfidService.reconnect();
        }
        
        // Always sync stock on click (works with or without RFID)
        await syncStock();
    }
});
