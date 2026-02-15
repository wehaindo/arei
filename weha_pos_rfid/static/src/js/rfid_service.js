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
                            handleRFIDTag(data.epc, data.rssi);
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
        async function handleRFIDTag(epc, rssi) {
            console.log("📡 RFID Tag scanned:", epc, "RSSI:", rssi);

            try {
                // Search for product by lot/serial number (EPC)
                const lot = await searchLotByEPC(epc);
                
                if (!lot) {
                    env.services.notification.add(`Tag ${epc} not found in system`, {
                        type: "warning",
                    });
                    return;
                }

                const product = lot.product_id;
                if (!product) {
                    env.services.notification.add(`No product associated with tag ${epc}`, {
                        type: "warning",
                    });
                    return;
                }

                // Get product details from POS
                const posProduct = pos.db.get_product_by_id(product[0]);
                
                if (!posProduct) {
                    env.services.notification.add(`Product ${product[1]} not available in POS`, {
                        type: "warning",
                    });
                    return;
                }

                // Add product to current order
                if (config.rfid_auto_add) {
                    const currentOrder = pos.get_order();
                    if (currentOrder) {
                        currentOrder.add_product(posProduct, {
                            quantity: 1,
                            merge: false, // Don't merge with existing lines for tracked products
                        });
                        
                        env.services.notification.add(`Added: ${posProduct.display_name}`, {
                            type: "success",
                        });
                    }
                } else {
                    env.services.notification.add(`Found: ${posProduct.display_name}`, {
                        type: "info",
                    });
                }

            } catch (error) {
                console.error("Error handling RFID tag:", error);
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
