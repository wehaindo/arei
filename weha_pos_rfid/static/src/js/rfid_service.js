/** @odoo-module */

import { registry } from "@web/core/registry";
import { Component } from "@odoo/owl";

/**
 * RFID Service - Handles WebSocket connection to RFID reader
 */
export const rfidService = {
    dependencies: ["pos"],
    
    start(env, { pos }) {
        let websocket = null;
        let isConnected = false;
        let reconnectTimer = null;
        const reconnectDelay = 3000; // 3 seconds

        /**
         * Connect to RFID WebSocket server
         */
        function connect() {
            const config = pos.config;
            
            if (!config.rfid_enabled) {
                console.log("RFID is not enabled in POS config");
                return;
            }

            const wsUrl = config.rfid_websocket_url || "ws://localhost:8081";
            console.log("Connecting to RFID WebSocket:", wsUrl);

            try {
                websocket = new WebSocket(wsUrl);

                websocket.onopen = function() {
                    isConnected = true;
                    console.log("✅ Connected to RFID WebSocket server");
                    env.services.notification.add("Connected to RFID reader", {
                        type: "success",
                    });
                    
                    // Clear reconnect timer
                    if (reconnectTimer) {
                        clearTimeout(reconnectTimer);
                        reconnectTimer = null;
                    }
                };

                websocket.onmessage = function(event) {
                    try {
                        const data = JSON.parse(event.data);
                        console.log("RFID WebSocket message:", data);

                        if (data.type === "tag" && data.epc) {
                            // Extract UID from EPC (last 12 characters typically)
                            const uid = data.epc.length > 12 ? data.epc.slice(-12) : data.epc;
                            handleRFIDTag(uid, data.rssi, data.epc);
                        } else if (data.type === "welcome") {
                            console.log("RFID Server:", data.message);
                        }
                    } catch (error) {
                        console.error("Error parsing RFID message:", error);
                    }
                };

                websocket.onerror = function(error) {
                    console.error("RFID WebSocket error:", error);
                    env.services.notification.add("RFID reader connection error", {
                        type: "danger",
                    });
                };

                websocket.onclose = function() {
                    isConnected = false;
                    console.log("RFID WebSocket closed");
                    
                    // Try to reconnect after delay
                    if (!reconnectTimer) {
                        reconnectTimer = setTimeout(() => {
                            console.log("Attempting to reconnect to RFID...");
                            connect();
                        }, reconnectDelay);
                    }
                };

            } catch (error) {
                console.error("Failed to create RFID WebSocket:", error);
            }
        }

        /**
         * Handle scanned RFID tag
         */
        async function handleRFIDTag(uid, rssi, fullEpc) {
            console.log("📡 RFID Tag scanned - UID:", uid, "RSSI:", rssi, "Full EPC:", fullEpc);

            try {
                // Search for product by lot/serial number using full EPC
                console.log("🔍 Searching for lot with EPC:", fullEpc);
                const lot = await searchLotByEPC(fullEpc);
                
                if (!lot) {
                    console.warn("⚠️ Lot not found for EPC:", fullEpc);
                    env.services.notification.add(`Tag ${uid} not found in system`, {
                        type: "warning",
                    });
                    return;
                }

                console.log("✅ Lot found:", lot);

                const product = lot.product_id;
                if (!product) {
                    console.warn("⚠️ No product linked to lot:", lot.name);
                    env.services.notification.add(`No product associated with tag ${uid}`, {
                        type: "warning",
                    });
                    return;
                }

                console.log("📦 Product from lot:", product);

                // Get product details from POS (Odoo 18 uses models.Product)
                const posProduct = pos.models["product.product"].get(product[0]);
                
                if (!posProduct) {
                    console.warn("⚠️ Product not available in POS:", product[1]);
                    env.services.notification.add(`Product ${product[1]} not available in POS`, {
                        type: "warning",
                    });
                    return;
                }

                console.log("✅ POS Product found:", posProduct);

                // Add product to current order
                if (pos.config.rfid_auto_add) {
                    const currentOrder = pos.get_order();
                    if (currentOrder) {
                        console.log("➕ Adding product to order:", posProduct.display_name);
                        await currentOrder.add_product(posProduct, {
                            quantity: 1,
                        });
                        
                        env.services.notification.add(`Added: ${posProduct.display_name}`, {
                            type: "success",
                        });
                        console.log("✅ Product added successfully");
                    } else {
                        console.warn("⚠️ No current order");
                    }
                } else {
                    env.services.notification.add(`Found: ${posProduct.display_name}`, {
                        type: "info",
                    });
                    console.log("ℹ️ Auto-add disabled, product not added");
                }

            } catch (error) {
                console.error("❌ Error handling RFID tag:", error);
                env.services.notification.add(`Error processing tag: ${error.message}`, {
                    type: "danger",
                });
            }
        }

        /**
         * Search for lot/serial by EPC
         */
        async function searchLotByEPC(epc) {
            try {
                const result = await env.services.orm.searchRead(
                    "stock.lot",
                    [["name", "=", epc]],
                    ["id", "name", "product_id"],
                    { limit: 1 }
                );
                
                return result.length > 0 ? result[0] : null;
            } catch (error) {
                console.error("Error searching lot:", error);
                return null;
            }
        }

        /**
         * Disconnect from RFID WebSocket
         */
        function disconnect() {
            if (websocket) {
                websocket.close();
                websocket = null;
            }
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            isConnected = false;
        }

        /**
         * Clear seen tags on RFID reader
         */
        function clearSeenTags() {
            if (websocket && isConnected) {
                websocket.send(JSON.stringify({ action: "clearSeen" }));
            }
        }

        // Auto-connect when service starts
        if (pos.config.rfid_enabled) {
            connect();
        }

        // Return service API
        return {
            connect,
            disconnect,
            clearSeenTags,
            get isConnected() {
                return isConnected;
            },
        };
    },
};

registry.category("services").add("rfid", rfidService);
