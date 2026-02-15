/** @odoo-module */

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { registry } from "@web/core/registry";

/**
 * RFID Button Component for POS
 */
export class RFIDButton extends Component {
    static template = "weha_pos_rfid.RFIDButton";

    setup() {
        this.pos = usePos();
        this.rfid = useService("rfid");
        this.notification = useService("notification");
    }

    get isRFIDEnabled() {
        return this.pos.config.rfid_enabled;
    }

    get isConnected() {
        return this.rfid.isConnected;
    }

    get buttonClass() {
        if (!this.isRFIDEnabled) {
            return "btn-secondary";
        }
        return this.isConnected ? "btn-success" : "btn-warning";
    }

    get buttonText() {
        if (!this.isRFIDEnabled) {
            return "RFID Disabled";
        }
        return this.isConnected ? "RFID Connected" : "RFID Connecting...";
    }

    get buttonIcon() {
        return this.isConnected ? "fa-wifi" : "fa-plug";
    }

    onClick() {
        if (!this.isRFIDEnabled) {
            this.notification.add("RFID is not enabled in POS configuration", {
                type: "warning",
            });
            return;
        }

        if (this.isConnected) {
            // Clear seen tags on reader
            this.rfid.clearSeenTags();
            this.notification.add("RFID reader cache cleared", {
                type: "info",
            });
        } else {
            // Try to reconnect
            this.rfid.connect();
        }
    }
}
