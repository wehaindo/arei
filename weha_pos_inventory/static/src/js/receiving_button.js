/** @odoo-module **/

import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { InventoryReceivingPopup } from "./inventory_receiving_popup";
import { registry } from "@web/core/registry";

// Register the popup
registry.category("popups").add("InventoryReceivingPopup", InventoryReceivingPopup);

patch(Navbar.prototype, {
    setup() {
        super.setup(...arguments);
        this.inventoryReceiving = useService("inventory_receiving");
    },
    
    showReceivingButton() {
        return this.inventoryReceiving.isEnabled() && 
               this.inventoryReceiving.isPosManager();
    },
    
    async onReceivingClick() {
        // Open receiving popup
        const inventoryReceiving = this.inventoryReceiving;
        
        if (!inventoryReceiving.isPosManager()) {
            this.notification.add(
                'Only POS administrators can access inventory receiving',
                { type: 'warning' }
            );
            return;
        }
        
        // Show receiving popup
        this.popup.add(InventoryReceivingPopup, {
            title: "Inventory Receiving",
        });
    }
});
