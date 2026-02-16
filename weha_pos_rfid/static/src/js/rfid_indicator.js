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
        
        if (rfidService.isConnected) {
            return 'RFID: Connected';
        } else if (rfidService.isConnecting) {
            return 'RFID: Connecting...';
        } else {
            return 'RFID: Disconnected';
        }
    },
    
    onRfidClick() {
        const rfidService = this.env.services.rfid;
        if (!rfidService) {
            this.notification.add('RFID service not available', {
                type: 'danger'
            });
            return;
        }
        
        if (!rfidService.isConnected && !rfidService.isConnecting) {
            rfidService.retryConnection();
        } else if (rfidService.isConnected) {
            this.notification.add(
                `RFID Reader connected at ws://localhost:${rfidService.port}`,
                { type: 'success' }
            );
        } else {
            this.notification.add(
                'RFID Reader is connecting...',
                { type: 'info' }
            );
        }
    }
});
