/** @odoo-module */

import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";
import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";

export class InventoryReceivingPopup extends AbstractAwaitablePopup {
    static template = "weha_pos_inventory.InventoryReceivingPopup";
    
    setup() {
        super.setup();
        this.pos = usePos();
        this.inventoryReceiving = useService("inventory_receiving");
        this.notification = useService("notification");
        
        this.state = useState({
            lines: [],
            selectedProduct: null,
            qty: 1,
            lotName: "",
            createdPicking: null,
        });
    }
    
    get products() {
        return Object.values(this.pos.models['product.product'].getAllBy('id')).filter(
            p => p.type === 'product' && p.available_in_pos
        );
    }
    
    onProductSelect(ev) {
        const productId = parseInt(ev.target.value);
        this.state.selectedProduct = this.pos.models['product.product'].get(productId);
        this.state.lotName = "";
    }
    
    addLine() {
        if (!this.state.selectedProduct) {
            this.notification.add("Please select a product", { type: "warning" });
            return;
        }
        
        if (this.state.qty <= 0) {
            this.notification.add("Quantity must be greater than 0", { type: "warning" });
            return;
        }
        
        const line = {
            product_id: this.state.selectedProduct.id,
            product_name: this.state.selectedProduct.display_name,
            qty: this.state.qty,
            lot_name: this.state.lotName || null,
            tracking: this.state.selectedProduct.tracking,
        };
        
        this.state.lines.push(line);
        
        // Reset form
        this.state.selectedProduct = null;
        this.state.qty = 1;
        this.state.lotName = "";
    }
    
    removeLine(index) {
        this.state.lines.splice(index, 1);
    }
    
    async createReceiving() {
        if (this.state.lines.length === 0) {
            this.notification.add("Please add at least one product", { type: "warning" });
            return;
        }
        
        const lines = this.state.lines.map(line => ({
            product_id: line.product_id,
            qty: line.qty,
            lot_name: line.lot_name,
        }));
        
        const result = await this.inventoryReceiving.createReceiving(lines);
        
        if (result) {
            this.state.createdPicking = result;
        }
    }
    
    async validateReceiving() {
        if (!this.state.createdPicking) {
            return;
        }
        
        const result = await this.inventoryReceiving.validateReceiving(
            this.state.createdPicking.id
        );
        
        if (result && result.success) {
            this.confirm();
        }
    }
    
    reset() {
        this.state.lines = [];
        this.state.createdPicking = null;
        this.state.selectedProduct = null;
        this.state.qty = 1;
        this.state.lotName = "";
    }
}
