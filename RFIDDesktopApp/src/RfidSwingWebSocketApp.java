import javax.swing.*;
import java.awt.*;
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

    // Set to track unique EPCs that have been sent
    private final Set<String> seenTags = ConcurrentHashMap.newKeySet();

    private final Gson gson = new Gson();

    public RfidSwingWebSocketApp() {
        super("Chainway R3 RFID (Unique Tags Only)");

        logArea = new JTextArea(15, 60);
        logArea.setEditable(false);

        connectBtn = new JButton("Connect & Start Auto-Scan (WebSocket)");
        JPanel top = new JPanel();
        top.add(connectBtn);

        add(top, BorderLayout.NORTH);
        add(new JScrollPane(logArea), BorderLayout.CENTER);

        connectBtn.addActionListener(e -> {
            connectBtn.setEnabled(false);
            startWebSocketServer(8081);

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
                appendLog("Error init reader: " + ex.getMessage());
            }
        });

        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        pack();
        setLocationRelativeTo(null);
        setVisible(true);
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
        appendLog("▶️ Auto-scan started (200ms interval, unique tags only)");
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
                        // Try multiple methods to get the actual tag ID
                        String epc = tag.getEPC();
                        String tid = tag.getTid();
                        String rssi = tag.getRssi();
                        
                        // Clean up the tag ID by removing trailing zeros
                        String tagId = null;
                        if (epc != null && !epc.isEmpty()) {
                            tagId = epc.replaceAll("0+$", ""); // Remove trailing zeros
                            if (tagId.isEmpty() || tagId.length() < 4) {
                                tagId = null; // EPC was all zeros or too short
                            } else {
                                // Add E2 prefix if not present (standard UHF RFID Gen2 format)
                                if (!tagId.startsWith("E2")) {
                                    tagId = "E2" + tagId;
                                }
                            }
                        }
                        
                        // If EPC is not valid, try TID
                        if (tagId == null && tid != null && !tid.isEmpty()) {
                            tagId = tid.replaceAll("0+$", ""); // Remove trailing zeros
                            if (tagId.isEmpty() || tagId.length() < 4) {
                                tagId = null;
                            }
                        }
                        
                        // If no valid tag ID, skip
                        if (tagId == null) {
                            continue;
                        }

                        // Check if this tag has ever been sent before
                        if (!seenTags.contains(tagId)) {
                            // This is a truly new unique tag
                            seenTags.add(tagId);
                            
                            TagMessage msg = new TagMessage(tagId, rssi, now, true);
                            String json = gson.toJson(msg);

                            appendLog("📡 UNIQUE TAG [" + seenTags.size() + "]: " + tagId + " | RSSI: " + rssi);
                            if (wsServer != null) wsServer.broadcast(json);
                        }
                        // If tag already exists in seenTags, do nothing (silently ignore)
                    }

                    // Scan setiap 200ms
                    Thread.sleep(200);

                } catch (Exception ex) {
                    appendLog("Scan error: " + ex.getMessage());
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException ignored) {
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
            if (message != null && message.contains("clearSeen")) {
                seenTags.clear();
                appendLog("🔄 seenTags cleared by client request");
                conn.send("{\"type\":\"ack\",\"message\":\"seenTags cleared\"}");
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
        SwingUtilities.invokeLater(RfidSwingWebSocketApp::new);
    }
}
