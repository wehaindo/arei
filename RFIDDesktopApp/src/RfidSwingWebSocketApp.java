import javax.swing.*;
import java.awt.*;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

import org.java_websocket.WebSocket;
import org.java_websocket.server.WebSocketServer;
import org.java_websocket.handshake.ClientHandshake;

import com.rscja.deviceapi.RFIDWithUHFUsb;
import com.rscja.deviceapi.entity.UHFTAGInfo;
import com.google.gson.Gson;

/**
 * RfidSwingWebSocketApp
 * - Swing UI + WebSocket server (ws://localhost:8081)
 * - Auto-scan with reader.inventory() every 200ms
 * - Broadcast ONLY unique EPCs (each tag sent only once)
 * - No TTL: once sent, never sent again unless cleared
 */
public class RfidSwingWebSocketApp extends JFrame {
    private JTextArea logArea;
    private JButton connectBtn;
    private RFIDWithUHFUsb reader;
    private ScanWorker scanWorker;
    private TagWebSocketServer wsServer;

    // Tag tracking with timestamps for TTL management
    private final Map<String, Long> seenTags;
    private final int maxSeenTags;
    
    // Configuration
    private final int wsPort;
    private final int scanIntervalMs;
    private final int minTagIdLength;
    private final boolean addE2Prefix;
    private final long tagTtlMs;  // Time-to-live: tag can be sent again after this period
    private final long autoResetInactivityMs;  // Auto-clear tags after inactivity
    private long lastScanActivityTime = 0;

    private final Gson gson = new Gson();
    private volatile boolean isShuttingDown = false;

    public RfidSwingWebSocketApp() {
        super("Chainway R3 RFID - POS Mode");

        // Load configuration
        Properties config = loadConfiguration();
        this.wsPort = Integer.parseInt(config.getProperty("ws.port", "8081"));
        this.scanIntervalMs = Integer.parseInt(config.getProperty("scan.interval.ms", "200"));
        this.maxSeenTags = Integer.parseInt(config.getProperty("cache.max.tags", "10000"));
        this.minTagIdLength = Integer.parseInt(config.getProperty("tag.min.length", "4"));
        this.addE2Prefix = Boolean.parseBoolean(config.getProperty("tag.add.e2.prefix", "true"));
        this.tagTtlMs = Long.parseLong(config.getProperty("tag.ttl.seconds", "5")) * 1000;
        this.autoResetInactivityMs = Long.parseLong(config.getProperty("auto.reset.inactivity.seconds", "30")) * 1000;
        
        // Initialize bounded LRU cache
        this.seenTags = Collections.synchronizedMap(new LinkedHashMap<String, Long>(maxSeenTags, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
                return size() > maxSeenTags;
            }
        });

        logArea = new JTextArea(15, 60);
        logArea.setEditable(false);

        connectBtn = new JButton("Connect & Start Auto-Scan (WebSocket)");
        JPanel top = new JPanel();
        top.add(connectBtn);

        add(top, BorderLayout.NORTH);
        add(new JScrollPane(logArea), BorderLayout.CENTER);

        connectBtn.addActionListener(e -> {
            connectBtn.setEnabled(false);
            startWebSocketServer(wsPort);

            try {
                reader = RFIDWithUHFUsb.getInstance();
                boolean inited = reader != null && reader.init("");
                if (inited) {
                    appendLog("✅ Connected to RSCJA RFID Reader");
                    startAutoScan();
                } else {
                    appendLog("❌ Failed to init RFID reader.");
                }
            } catch (Exception ex) {
                appendLog("❌ Error init reader: " + ex.getMessage());
                ex.printStackTrace();
            }
        });

        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        pack();
        setLocationRelativeTo(null);
        setVisible(true);
    }

    /**
     * Load configuration from rfid.properties file or use defaults
     */
    private Properties loadConfiguration() {
        Properties props = new Properties();
        
        // Try to load from file
        try (InputStream input = new FileInputStream("rfid.properties")) {
            props.load(input);
            appendLog("✅ Configuration loaded from rfid.properties");
        } catch (IOException ex) {
            appendLog("⚠️ Using default configuration (rfid.properties not found)");
        }
        
        return props;
    }

    private void startWebSocketServer(int port) {
        try {
            wsServer = new TagWebSocketServer(new InetSocketAddress(port));
            wsServer.start();
            appendLog("✅ WebSocket server started at ws://localhost:" + port);
        } catch (Exception ex) {
            appendLog("❌ Failed to start WebSocket server: " + ex.getMessage());
        }
    }

    private void startAutoScan() {
        scanWorker = new ScanWorker();
        scanWorker.start();
        String ttlInfo = tagTtlMs > 0 ? ", TTL: " + (tagTtlMs/1000) + "s" : ", No TTL";
        String resetInfo = autoResetInactivityMs > 0 ? ", Auto-reset: " + (autoResetInactivityMs/1000) + "s" : "";
        appendLog("▶️ POS Mode started (" + scanIntervalMs + "ms scan" + ttlInfo + resetInfo + ")");
    }

    /**
     * Cleanup resources before shutdown
     */
    private void cleanup() {
        if (isShuttingDown) return;
        isShuttingDown = true;
        
        appendLog("🔄 Shutting down...");
        
        // Stop scanning thread
        if (scanWorker != null) {
            scanWorker.stopScanning();
            try {
                scanWorker.join(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        
        // Close RFID reader
        if (reader != null) {
            try {
                reader.free();
                appendLog("✅ RFID reader closed");
            } catch (Exception e) {
                appendLog("⚠️ Error closing RFID reader: " + e.getMessage());
            }
        }
        
        // Stop WebSocket server
        if (wsServer != null) {
            try {
                wsServer.stop(1000);
                appendLog("✅ WebSocket server stopped");
            } catch (Exception e) {
                appendLog("⚠️ Error stopping WebSocket server: " + e.getMessage());
            }
        }
        
        appendLog("✅ Cleanup complete");
    }

    private void appendLog(String line) {
        SwingUtilities.invokeLater(() -> {
            logArea.append(line + "\n");
            logArea.setCaretPosition(logArea.getDocument().getLength());
        });
    }

    // Thread untuk scanning cepat menggunakan inventorySingleTag
    private class ScanWorker extends Thread {
        private volatile boolean running = true;
        
        @Override
        public void run() {
            while (running) {
                try {
                    // Gunakan inventorySingleTag() karena inventory() tidak tersedia
                    UHFTAGInfo tag = reader.inventorySingleTag();
                    long now = System.currentTimeMillis();

                    if (tag != null) {
                        String epc = tag.getEPC();
                        String tid = tag.getTid();
                        String rssi = tag.getRssi();
                        
                        // Extract and clean tag ID
                        String tagId = extractTagId(epc, tid);
                        
                        // Skip invalid tags
                        if (tagId == null || tagId.length() < minTagIdLength) {
                            continue;
                        }

                        // Check auto-reset based on inactivity
                        if (autoResetInactivityMs > 0 && lastScanActivityTime > 0) {
                            long inactivityDuration = now - lastScanActivityTime;
                            if (inactivityDuration > autoResetInactivityMs) {
                                int clearedCount = seenTags.size();
                                seenTags.clear();
                                appendLog("🔄 Auto-reset: Cleared " + clearedCount + " tags after " + (inactivityDuration/1000) + "s inactivity");
                            }
                        }
                        lastScanActivityTime = now;

                        // Check if tag can be sent (new or TTL expired)
                        Long lastSeenTime = seenTags.get(tagId);
                        boolean shouldSend = false;
                        boolean isFirstSeen = false;
                        
                        if (lastSeenTime == null) {
                            // First time seeing this tag
                            shouldSend = true;
                            isFirstSeen = true;
                        } else if (tagTtlMs > 0 && (now - lastSeenTime) >= tagTtlMs) {
                            // Tag TTL expired, can send again
                            shouldSend = true;
                            isFirstSeen = false;
                        }
                        
                        if (shouldSend) {
                            seenTags.put(tagId, now);
                            
                            TagMessage msg = new TagMessage(tagId, rssi, now, isFirstSeen);
                            String json = gson.toJson(msg);

                            String status = isFirstSeen ? "NEW" : "RE-SCAN";
                            appendLog("📡 " + status + " [" + seenTags.size() + "]: " + tagId + " | RSSI: " + rssi);
                            if (wsServer != null) wsServer.broadcast(json);
                        }
                    }

                    // Scan at configured interval
                    Thread.sleep(scanIntervalMs);

                } catch (InterruptedException ex) {
                    appendLog("⚠️ Scan interrupted, stopping...");
                    break;
                } catch (Exception ex) {
                    appendLog("❌ Scan error: " + ex.getClass().getSimpleName() + " - " + ex.getMessage());
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
        
        public void stopScanning() {
            running = false;
            interrupt();
        }
    }

    /**
     * Extract and clean tag ID from EPC or TID
     * Standard format: E2 prefix + 22 hex characters = 24 total
     */
    private String extractTagId(String epc, String tid) {
        String tagId = null;
        
        // Try EPC first
        if (epc != null && !epc.isEmpty()) {
            tagId = epc.trim().toUpperCase();
            
            // Remove trailing zeros (common padding)
            tagId = tagId.replaceAll("0+$", "");
            
            // Pad to 22 characters if shorter
            if (tagId.length() < 22) {
                tagId = String.format("%-22s", tagId).replace(' ', '0');
            }
            // Truncate if longer than 22 characters
            else if (tagId.length() > 22) {
                tagId = tagId.substring(0, 22);
            }
            
            // Add E2 prefix for Gen2 tags if configured, not present, and exactly 22 hex digits
            if (addE2Prefix && tagId.length() == 22 && !tagId.startsWith("E2")) {
                // Validate it's valid hex before adding prefix
                if (tagId.matches("[0-9A-F]{22}")) {
                    tagId = "E2" + tagId;
                }
            }
        }
        
        // Fallback to TID if EPC is invalid
        if ((tagId == null || tagId.isEmpty()) && tid != null && !tid.isEmpty()) {
            tagId = tid.trim().toUpperCase().replaceAll("0+$", "");
        }
        
        return (tagId != null && !tagId.isEmpty()) ? tagId : null;
    }

    // POJO untuk JSON
    static class TagMessage {
        String type = "tag";  // Message type identifier
        String epc;
        String rssi;
        long timestamp;
        boolean firstSeen;

        TagMessage(String epc, String rssi, long timestamp, boolean firstSeen) {
            this.epc = epc;
            this.rssi = rssi;
            this.timestamp = timestamp;
            this.firstSeen = firstSeen;
        }
    }

    // WebSocket server
    private class TagWebSocketServer extends WebSocketServer {
        private final Set<WebSocket> conns = new CopyOnWriteArraySet<>();

        TagWebSocketServer(InetSocketAddress addr) {
            super(addr);
        }

        @Override
        public void onOpen(WebSocket conn, ClientHandshake handshake) {
            conns.add(conn);
            conn.send("{\"type\":\"welcome\",\"message\":\"Connected to RFID WebSocket Server\"}");
            appendLog("WS: Client connected: " + conn.getRemoteSocketAddress());
        }

        @Override
        public void onClose(WebSocket conn, int code, String reason, boolean remote) {
            conns.remove(conn);
            appendLog("WS: Client disconnected: " + conn.getRemoteSocketAddress());
        }

        @Override
        public void onMessage(WebSocket conn, String message) {
            appendLog("WS: Received from client: " + message);
            
            try {
                if (message != null) {
                    // Handle clear/reset transaction
                    if (message.contains("clearSeen") || message.contains("resetTransaction")) {
                        int clearedCount = seenTags.size();
                        seenTags.clear();
                        lastScanActivityTime = System.currentTimeMillis();
                        appendLog("🔄 Transaction reset: Cleared " + clearedCount + " tags");
                        conn.send("{\"type\":\"ack\",\"action\":\"reset\",\"clearedCount\":" + clearedCount + "}");
                    }
                    // Handle status request
                    else if (message.contains("getStatus")) {
                        String status = "{\"type\":\"status\",\"tagCount\":" + seenTags.size() + 
                                       ",\"ttlSeconds\":" + (tagTtlMs/1000) + 
                                       ",\"autoResetSeconds\":" + (autoResetInactivityMs/1000) + "}";
                        conn.send(status);
                    }
                }
            } catch (Exception e) {
                appendLog("❌ Error processing message: " + e.getMessage());
                conn.send("{\"type\":\"error\",\"message\":\"" + e.getMessage() + "\"}");
            }
        }

        @Override
        public void onError(WebSocket conn, Exception ex) {
            appendLog("WS Error: " + ex.getMessage());
        }

        @Override
        public void onStart() {
            appendLog("WS Server started successfully");
        }

        public void broadcast(String text) {
            for (WebSocket s : conns) {
                if (s.isOpen()) s.send(text);
            }
        }
    }

    public static void main(String[] args) {
        RfidSwingWebSocketApp[] appHolder = new RfidSwingWebSocketApp[1];
        
        SwingUtilities.invokeLater(() -> {
            appHolder[0] = new RfidSwingWebSocketApp();
            
            // Add window listener for cleanup on close
            appHolder[0].addWindowListener(new java.awt.event.WindowAdapter() {
                @Override
                public void windowClosing(java.awt.event.WindowEvent e) {
                    appHolder[0].cleanup();
                }
            });
        });
        
        // Add shutdown hook for cleanup on JVM termination
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (appHolder[0] != null && !appHolder[0].isShuttingDown) {
                appHolder[0].cleanup();
            }
        }));
    }
}
