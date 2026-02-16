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
        let isConnecting = false;
        let reconnectTimer = null;
        let reconnectAttempts = 0;
        const baseReconnectDelay = 2000; // 2 seconds
        const maxReconnectDelay = 30000; // 30 seconds
        const maxReconnectAttempts = 10; // Max attempts before giving up
        let shouldReconnect = true; // Flag to control auto-reconnect

        /**
         * Connect to RFID WebSocket server
         */
        function connect(manualRetry = false) {
            const config = pos.config;
            
            if (!config.rfid_enabled) {
                console.log("RFID is not enabled in POS config");
                return;
            }

            // Prevent multiple simultaneous connection attempts
            if (isConnecting) {
                console.log("⏳ Connection attempt already in progress...");
                return;
            }

            // Check if max retry attempts reached
            if (!manualRetry && maxReconnectAttempts > 0 && reconnectAttempts >= maxReconnectAttempts) {
                console.warn("❌ Max reconnection attempts reached. Use manual retry.");
                env.services.notification.add(
                    `RFID connection failed after ${maxReconnectAttempts} attempts. Click to retry manually.`,
                    {
                        type: "danger",
                        sticky: true,
                    }
                );
                return;
            }

            const wsUrl = config.rfid_websocket_url || "ws://localhost:8081";
            const attemptInfo = reconnectAttempts > 0 ? ` (Attempt ${reconnectAttempts + 1})` : "";
            console.log(`Connecting to RFID WebSocket: ${wsUrl}${attemptInfo}`);

            isConnecting = true;

            try {
                websocket = new WebSocket(wsUrl);

                websocket.onopen = function() {
                    isConnected = true;
                    isConnecting = false;
                    reconnectAttempts = 0; // Reset attempts on successful connection
                    shouldReconnect = true;
                    
                    const wasReconnecting = reconnectTimer !== null;
                    console.log("✅ Connected to RFID WebSocket server");
                    
                    const message = wasReconnecting 
                        ? "Reconnected to RFID reader" 
                        : "Connected to RFID reader";
                    
                    env.services.notification.add(message, {
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
                    isConnecting = false;
                    console.error("RFID WebSocket error:", error);
                    
                    // Only show notification on first error or every 5th attempt
                    if (reconnectAttempts === 0 || reconnectAttempts % 5 === 0) {
                        env.services.notification.add(
                            `RFID reader connection error (Attempt ${reconnectAttempts + 1})`,
                            { type: "danger" }
                        );
                    }
                };

                websocket.onclose = function(event) {
                    isConnected = false;
                    isConnecting = false;
                    
                    const closeReason = event.reason || "Connection closed";
                    console.log(`RFID WebSocket closed: ${closeReason} (Code: ${event.code})`);
                    
                    // Auto-reconnect if enabled and not a normal closure
                    if (shouldReconnect && event.code !== 1000) {
                        reconnectAttempts++;
                        
                        // Calculate exponential backoff delay
                        const delay = Math.min(
                            baseReconnectDelay * Math.pow(1.5, reconnectAttempts - 1),
                            maxReconnectDelay
                        );
                        
                        console.log(`⏳ Reconnecting in ${(delay/1000).toFixed(1)}s... (Attempt ${reconnectAttempts})`);
                        
                        // Clear any existing timer
                        if (reconnectTimer) {
                            clearTimeout(reconnectTimer);
                        }
                        
                        // Schedule reconnection
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            console.log(`🔄 Attempting to reconnect to RFID... (Attempt ${reconnectAttempts})`);
                            connect();
                        }, delay);
                    } else if (event.code === 1000) {
                        console.log("✅ RFID WebSocket closed normally");
                    }
                };

            } catch (error) {
                isConnecting = false;
                console.error("Failed to create RFID WebSocket:", error);
                env.services.notification.add(
                    `Failed to connect to RFID reader: ${error.message}`,
                    { type: "danger" }
                );
                
                // Try to reconnect on connection creation failure
                if (shouldReconnect) {
                    reconnectAttempts++;
                    const delay = Math.min(
                        baseReconnectDelay * Math.pow(1.5, reconnectAttempts - 1),
                        maxReconnectDelay
                    );
                    
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        connect();
                    }, delay);
                }
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

                // Add product to current order (Odoo 18 method)
                if (pos.config.rfid_auto_add) {
                    const currentOrder = pos.get_order();
                    if (currentOrder) {
                        console.log("➕ Adding product to order:", posProduct.display_name);
                        
                        // Odoo 18: Use pos.addLineToCurrentOrder
                        await pos.addLineToCurrentOrder({ 
                            product_id: posProduct 
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
            shouldReconnect = false; // Disable auto-reconnect
            
            if (websocket) {
                websocket.close(1000, "Manual disconnect"); // Normal closure
                websocket = null;
            }
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            isConnected = false;
            isConnecting = false;
            reconnectAttempts = 0;
            console.log("🔌 Disconnected from RFID reader");
        }

        /**
         * Clear seen tags on RFID reader (for new transaction)
         */
        function clearSeenTags() {
            if (websocket && isConnected) {
                websocket.send(JSON.stringify({ clearSeen: true }));
                console.log("🔄 Sent transaction reset to RFID reader");
            } else {
                console.warn("⚠️ Cannot clear tags - not connected to RFID reader");
            }
        }

        /**
         * Manually retry connection (resets attempt counter)
         */
        function retryConnection() {
            reconnectAttempts = 0;
            shouldReconnect = true;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            connect(true);
        }

        /**
         * Get connection status
         */
        function getStatus() {
            return {
                connected: isConnected,
                connecting: isConnecting,
                attempts: reconnectAttempts,
                willReconnect: shouldReconnect,
            };
        }

        // Auto-connect when service starts
        if (pos.config.rfid_enabled) {
            connect();
        }

        // Return service API
        return {
            connect,
            disconnect,
            reconnect: retryConnection,
            clearSeenTags,
            getStatus,
            get isConnected() {
                return isConnected;
            },
            get isConnecting() {
                return isConnecting;
            },
        };
    },
};

registry.category("services").add("rfid", rfidService);
