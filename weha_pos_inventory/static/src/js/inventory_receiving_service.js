/** @odoo-module */

import { registry } from "@web/core/registry";

/**
 * Inventory Receiving Service
 */
export const inventoryReceivingService = {
    dependencies: ["pos", "orm", "notification"],
    
    start(env, { pos, orm, notification }) {
        
        /**
         * Create a receiving order
         */
        async function createReceiving(lines) {
            try {
                const session = pos.get_session();
                
                if (!session) {
                    notification.add("No active POS session", { type: "danger" });
                    return null;
                }
                
                const vals = {
                    pos_session_id: session.id,
                    lines: lines, // Array of {product_id, qty, lot_name}
                };
                
                const result = await orm.call(
                    "stock.picking",
                    "create_pos_receiving",
                    [vals]
                );
                
                notification.add(
                    `Receiving order ${result.name} created`,
                    { type: "success" }
                );
                
                return result;
            } catch (error) {
                console.error("Error creating receiving:", error);
                notification.add(
                    `Error: ${error.message || error.data?.message || "Failed to create receiving"}`,
                    { type: "danger" }
                );
                return null;
            }
        }
        
        /**
         * Validate a receiving order
         */
        async function validateReceiving(pickingId) {
            try {
                const result = await orm.call(
                    "stock.picking",
                    "validate_pos_receiving",
                    [pickingId]
                );
                
                notification.add(
                    result.message || "Receiving validated successfully",
                    { type: "success" }
                );
                
                return result;
            } catch (error) {
                console.error("Error validating receiving:", error);
                notification.add(
                    `Error: ${error.message || error.data?.message || "Failed to validate receiving"}`,
                    { type: "danger" }
                );
                return null;
            }
        }
        
        /**
         * Check if user is POS manager
         */
        function isPosManager() {
            const user = pos.get_cashier() || pos.user;
            return user && user.role === 'manager';
        }
        
        /**
         * Check if inventory receiving is enabled
         */
        function isEnabled() {
            return pos.config.enable_inventory_receiving;
        }
        
        return {
            createReceiving,
            validateReceiving,
            isPosManager,
            isEnabled,
        };
    },
};

registry.category("services").add("inventory_receiving", inventoryReceivingService);
