/** @odoo-module */

import { registry } from "@web/core/registry";
import { reactive } from "@odoo/owl";

/**
 * RFID Service - Handles WebSocket connection to RFID reader
 */
export const rfidService = {
    dependencies: ["pos"],
    
    start(env, { pos }) {
        let websocket = null;
        
        // Use reactive state so UI components update automatically
        const state = reactive({
            isConnected: false,
            isConnecting: false,
            reconnectAttempts: 0,
        });
        
        let reconnectTimer = null;
        const baseReconnectDelay = 2000; // 2 seconds
        const maxReconnectDelay = 30000; // 30 seconds
        const maxReconnectAttempts = 10; // Max attempts before giving up
        let shouldReconnect = true; // Flag to control auto-reconnect

        // Cache for lot stock quantities (offline checking)
        let lotStockCache = new Map(); // Map<lot_name, {product_id, product_qty, location_id}>
        let lastSyncTime = null;

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
            if (state.isConnecting) {
                console.log("⏳ Connection attempt already in progress...");
                return;
            }

            // Check if max retry attempts reached
            if (!manualRetry && maxReconnectAttempts > 0 && state.reconnectAttempts >= maxReconnectAttempts) {
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
            const attemptInfo = state.reconnectAttempts > 0 ? ` (Attempt ${state.reconnectAttempts + 1})` : "";
            console.log(`Connecting to RFID WebSocket: ${wsUrl}${attemptInfo}`);

            state.isConnecting = true;

            try {
                websocket = new WebSocket(wsUrl);

                websocket.onopen = function() {
                    state.isConnected = true;
                    state.isConnecting = false;
                    state.reconnectAttempts = 0; // Reset attempts on successful connection
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
                    state.isConnecting = false;
                    console.error("RFID WebSocket error:", error);
                    
                    // Only show notification on first error or every 5th attempt
                    if (state.reconnectAttempts === 0 || state.reconnectAttempts % 5 === 0) {
                        env.services.notification.add(
                            `RFID reader connection error (Attempt ${state.reconnectAttempts + 1})`,
                            { type: "danger" }
                        );
                    }
                };

                websocket.onclose = function(event) {
                    state.isConnected = false;
                    state.isConnecting = false;
                    
                    const closeReason = event.reason || "Connection closed";
                    console.log(`RFID WebSocket closed: ${closeReason} (Code: ${event.code})`);
                    
                    // Auto-reconnect if enabled and not a normal closure
                    if (shouldReconnect && event.code !== 1000) {
                        state.reconnectAttempts++;
                        
                        // Calculate exponential backoff delay
                        const delay = Math.min(
                            baseReconnectDelay * Math.pow(1.5, state.reconnectAttempts - 1),
                            maxReconnectDelay
                        );
                        
                        console.log(`⏳ Reconnecting in ${(delay/1000).toFixed(1)}s... (Attempt ${state.reconnectAttempts})`);
                        
                        // Clear any existing timer
                        if (reconnectTimer) {
                            clearTimeout(reconnectTimer);
                        }
                        
                        // Schedule reconnection
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            console.log(`🔄 Attempting to reconnect to RFID... (Attempt ${state.reconnectAttempts})`);
                            connect();
                        }, delay);
                    } else if (event.code === 1000) {
                        console.log("✅ RFID WebSocket closed normally");
                    }
                };

            } catch (error) {
                state.isConnecting = false;
                console.error("Failed to create RFID WebSocket:", error);
                env.services.notification.add(
                    `Failed to connect to RFID reader: ${error.message}`,
                    { type: "danger" }
                );
                
                // Try to reconnect on connection creation failure
                if (shouldReconnect) {
                    state.reconnectAttempts++;
                    const delay = Math.min(
                        baseReconnectDelay * Math.pow(1.5, state.reconnectAttempts - 1),
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
                        // Check if lot/serial is already in the current order
                        if (posProduct.tracking !== 'none') {
                            const existingLine = currentOrder.lines.find(line => {
                                if (line.product_id.id !== posProduct.id) {
                                    return false;
                                }
                                // Check pack lot lines for this lot/serial
                                const packLots = line.pack_lot_ids || [];
                                return packLots.some(packLot => packLot.lot_name === lot.name);
                            });
                            
                            if (existingLine) {
                                console.warn("⚠️ Lot/Serial already in order:", lot.name);
                                env.services.notification.add(
                                    `${posProduct.display_name} with lot/serial ${lot.name} is already in the order`,
                                    { type: "warning" }
                                );
                                return;
                            }
                        }
                        
                        console.log("➕ Adding product to order:", posProduct.display_name);
                        
                        // Prepare options with lot/serial number to skip popup
                        const opts = {};
                        
                        // If product has tracking, automatically assign the lot we found
                        if (posProduct.tracking !== 'none') {
                            opts.code = {
                                type: 'lot',
                                code: lot.name  // Use the lot name (EPC) we already found
                            };
                            opts.draftPackLotLines = {
                                modifiedPackLotLines: {},
                                newPackLotLines: [{ lot_name: lot.name }]
                            };
                            console.log("📦 Auto-assigning lot/serial:", lot.name);
                        }
                        
                        // Odoo 18: Use pos.addLineToCurrentOrder with lot info
                        await pos.addLineToCurrentOrder({ 
                            product_id: posProduct 
                        }, opts);
                        
                        // Update cache quantity after successful addition
                        if (lotStockCache.has(lot.name)) {
                            const cached = lotStockCache.get(lot.name);
                            cached.product_qty = Math.max(0, cached.product_qty - 1);
                            lotStockCache.set(lot.name, cached);
                            console.log("📊 Updated cache quantity for", lot.name, ":", cached.product_qty);
                        }
                        
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
            // First check cache
            if (lotStockCache.has(epc)) {
                const cached = lotStockCache.get(epc);
                console.log("📦 Using cached lot data for:", epc);
                
                // Check stock quantity
                if (cached.product_qty <= 0) {
                    console.warn("⚠️ No stock available for lot:", epc);
                    env.services.notification.add(
                        `No stock available for lot/serial ${epc}`,
                        { type: "warning" }
                    );
                    return null;
                }
                
                return {
                    name: epc,
                    product_id: cached.product_id,
                    product_qty: cached.product_qty
                };
            }
            
            // If not in cache, fetch from database with location filter
            try {
                const config = pos.config;
                let locationId = null;
                
                // Get store location if configured
                if (config.picking_type_id && config.picking_type_id[0]) {
                    const pickingType = await env.services.orm.searchRead(
                        "stock.picking.type",
                        [["id", "=", config.picking_type_id[0]]],
                        ["default_location_src_id"],
                        { limit: 1 }
                    );
                    
                    if (pickingType.length > 0 && pickingType[0].default_location_src_id) {
                        locationId = pickingType[0].default_location_src_id[0];
                        console.log("📍 Filtering by store location:", locationId);
                    }
                }
                
                // First find the lot by name
                const lotResult = await env.services.orm.searchRead(
                    "stock.lot",
                    [["name", "=", epc]],
                    ["id", "name", "product_id"],
                    { limit: 1 }
                );
                
                if (lotResult.length === 0) {
                    return null;
                }
                
                const lot = lotResult[0];
                
                // Then check stock quantity in the location
                const quantDomain = [
                    ["lot_id", "=", lot.id],
                    ["quantity", ">", 0]
                ];
                
                if (locationId) {
                    quantDomain.push(["location_id", "=", locationId]);
                }
                
                const quants = await env.services.orm.searchRead(
                    "stock.quant",
                    quantDomain,
                    ["quantity"]
                );
                
                // Sum up quantities
                const totalQty = quants.reduce((sum, q) => sum + q.quantity, 0);
                
                if (totalQty <= 0) {
                    console.warn("⚠️ No stock available for lot:", lot.name);
                    env.services.notification.add(
                        `No stock available for lot/serial ${lot.name}`,
                        { type: "warning" }
                    );
                    return null;
                }
                
                // Add to cache
                lotStockCache.set(lot.name, {
                    product_id: lot.product_id,
                    product_qty: totalQty
                });
                
                return {
                    name: lot.name,
                    product_id: lot.product_id,
                    product_qty: totalQty
                };
                
                return null;
            } catch (error) {
                console.error("Error searching lot:", error);
                return null;
            }
        }

        /**
         * Sync lot stock quantities from database to local cache
         * Filtered by POS store location
         */
        async function syncLotStock() {
            try {
                console.log("🔄 Syncing lot stock quantities for store...");
                
                const config = pos.config;
                let locationId = null;
                
                // Get POS store location
                if (config.picking_type_id && config.picking_type_id[0]) {
                    const pickingType = await env.services.orm.searchRead(
                        "stock.picking.type",
                        [["id", "=", config.picking_type_id[0]]],
                        ["default_location_src_id"],
                        { limit: 1 }
                    );
                    
                    if (pickingType.length > 0 && pickingType[0].default_location_src_id) {
                        locationId = pickingType[0].default_location_src_id[0];
                        console.log("📍 Syncing stock for location:", locationId);
                    }
                }
                
                if (!locationId) {
                    console.warn("⚠️ No location configured, syncing all lots");
                }
                
                // Query stock.quant to get quantities by location and lot
                const quantDomain = [["quantity", ">", 0]];
                if (locationId) {
                    quantDomain.push(["location_id", "=", locationId]);
                }
                
                const quants = await env.services.orm.searchRead(
                    "stock.quant",
                    quantDomain,
                    ["lot_id", "product_id", "quantity", "location_id"]
                );
                
                console.log(`📦 Found ${quants.length} stock quants in location`);
                
                // Update cache - group by lot_id
                lotStockCache.clear();
                const lotQuantities = new Map();
                
                quants.forEach(quant => {
                    if (quant.lot_id) {
                        const lotId = quant.lot_id[0];
                        const lotName = quant.lot_id[1];
                        const qty = quant.quantity;
                        
                        if (lotQuantities.has(lotName)) {
                            lotQuantities.get(lotName).product_qty += qty;
                        } else {
                            lotQuantities.set(lotName, {
                                product_id: quant.product_id,
                                product_qty: qty
                            });
                        }
                    }
                });
                
                // Store in cache
                lotQuantities.forEach((value, key) => {
                    lotStockCache.set(key, value);
                });
                
                lastSyncTime = new Date();
                console.log(`✅ Synced ${lotStockCache.size} lots from store to cache`);
                
                env.services.notification.add(
                    `Stock synced: ${lotStockCache.size} items in store`,
                    { type: "success" }
                );
                
                return lotStockCache.size;
            } catch (error) {
                console.error("❌ Error syncing lot stock:", error);
                env.services.notification.add(
                    `Error syncing stock: ${error.message}`,
                    { type: "danger" }
                );
                return 0;
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
            state.reconnectAttempts = 0;
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
                connected: state.isConnected,
                connecting: state.isConnecting,
                attempts: state.reconnectAttempts,
                willReconnect: shouldReconnect,
            };
        }

        // Auto-connect when service starts
        if (pos.config.rfid_enabled) {
            connect();
        }
        
        // Auto-sync stock when service starts (independent of RFID connection)
        setTimeout(() => {
            if (lotStockCache.size === 0 || !lastSyncTime || 
                (new Date() - lastSyncTime) > 3600000) { // 1 hour
                console.log("🔄 Starting initial stock sync...");
                syncLotStock().catch(err => {
                    console.error("❌ Initial stock sync failed:", err);
                });
            } else {
                console.log("✅ Stock cache already synced");
            }
        }, 2000); // Delay 2s to let POS fully initialize

        // Return service API (expose reactive state)
        return {
            state, // Expose reactive state for components
            connect,
            disconnect,
            reconnect: retryConnection,
            clearSeenTags,
            syncLotStock, // Expose sync method
            getStatus,
            get isConnected() {
                return state.isConnected;
            },
            get isConnecting() {
                return state.isConnecting;
            },
            get lastSyncTime() {
                return lastSyncTime;
            },
            get cachedLotsCount() {
                return lotStockCache.size;
            },
        };
    },
};

registry.category("services").add("rfid", rfidService);
