/** @odoo-module */

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * RFID Connection Status Indicator for POS Navbar
 */
export class RFIDIndicator extends Component {
    static template = "weha_pos_rfid.RFIDIndicator";

    setup() {
        this.rfid = useService("rfid");
        this.notification = useService("notification");
    }

    get connectionStatus() {
        const status = this.rfid.getStatus();
        return {
            isConnected: status.connected,
            isConnecting: status.connecting,
            attempts: status.attempts,
            statusText: this.getStatusText(status),
            statusClass: this.getStatusClass(status),
            statusIcon: this.getStatusIcon(status),
        };
    }

    getStatusText(status) {
        if (status.connected) {
            return "RFID Connected";
        } else if (status.connecting) {
            return `Connecting${status.attempts > 0 ? ` (${status.attempts})` : ''}...`;
        } else {
            return "RFID Disconnected";
        }
    }

    getStatusClass(status) {
        if (status.connected) {
            return "rfid-connected";
        } else if (status.connecting) {
            return "rfid-connecting";
        } else {
            return "rfid-disconnected";
        }
    }

    getStatusIcon(status) {
        if (status.connected) {
            return "fa-wifi text-success";
        } else if (status.connecting) {
            return "fa-spinner fa-spin text-warning";
        } else {
            return "fa-wifi text-danger";
        }
    }

    onClick() {
        const status = this.rfid.getStatus();
        
        if (status.connected) {
            // Show connected info
            this.notification.add("RFID reader is connected and ready", {
                type: "info",
            });
        } else if (status.connecting) {
            this.notification.add(`Connecting to RFID reader (Attempt ${status.attempts})...`, {
                type: "info",
            });
        } else {
            // Try to reconnect
            this.rfid.reconnect();
            this.notification.add("Attempting to reconnect to RFID reader...", {
                type: "info",
            });
        }
    }
}
