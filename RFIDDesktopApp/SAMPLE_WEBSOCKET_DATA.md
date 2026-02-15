# WebSocket Data Samples - RFID Desktop App

## 📡 Connection URL
```
ws://localhost:8081
```

---

## 📨 Message 1: Welcome Message (On Connection)

When a client first connects to the WebSocket server:

```json
{
  "type": "welcome",
  "message": "Connected to RFID WebSocket Server"
}
```

---

## 📨 Message 2: RFID Tag Detection (Main Data)

When a **unique** RFID tag is detected for the first time:

### Example 1: First Tag
```json
{
  "type": "tag",
  "epc": "E28011700000020396ECAB9A",
  "rssi": "-45",
  "timestamp": 1736208000000,
  "firstSeen": true
}
```

### Example 2: Second Tag
```json
{
  "type": "tag",
  "epc": "E28011700000020396ECAB9B",
  "rssi": "-52",
  "timestamp": 1736208000200,
  "firstSeen": true
}
```

### Example 3: Third Tag
```json
{
  "type": "tag",
  "epc": "E2801170000002039ABC1234",
  "rssi": "-48",
  "timestamp": 1736208000400,
  "firstSeen": true
}
```

### Example 4: Product Tag
```json
{
  "type": "tag",
  "epc": "303530363537383930313233",
  "rssi": "-38",
  "timestamp": 1736208000600,
  "firstSeen": true
}
```

### Example 5: Weak Signal Tag
```json
{
  "type": "tag",
  "epc": "AABBCCDD11223344556677FF",
  "rssi": "-75",
  "timestamp": 1736208000800,
  "firstSeen": true
}
```

---

## 📊 Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `type` | String | Message type identifier | `"tag"` |
| `epc` | String | Electronic Product Code (unique tag ID) | `"E28011700000020396ECAB9A"` |
| `rssi` | String | Signal strength in dBm (closer = higher) | `"-45"` (strong), `"-75"` (weak) |
| `timestamp` | Long | Unix timestamp in milliseconds | `1736208000000` |
| `firstSeen` | Boolean | Always `true` (indicates unique tag) | `true` |

---

## 📨 Message 3: Acknowledgment (Response to Client Command)

When client sends `{"clearSeen": true}` to reset the cache:

```json
{
  "type": "ack",
  "message": "seenTags cleared"
}
```

---

## 🎬 Complete Session Example

Here's what a typical WebSocket session looks like:

### Timeline:

**T=0ms: Client Connects**
```json
{
  "type": "welcome",
  "message": "Connected to RFID WebSocket Server"
}
```

**T=1000ms: First tag detected (Tag A)**
```json
{
  "type": "tag",
  "epc": "E28011700000020396ECAB9A",
  "rssi": "-45",
  "timestamp": 1736208001000,
  "firstSeen": true
}
```

**T=1200ms: Tag A detected again**
```
(No message sent - already seen)
```

**T=2000ms: Second tag detected (Tag B)**
```json
{
  "type": "tag",
  "epc": "E28011700000020396ECAB9B",
  "rssi": "-52",
  "timestamp": 1736208002000,
  "firstSeen": true
}
```

**T=3000ms: Third tag detected (Tag C)**
```json
{
  "type": "tag",
  "epc": "E2801170000002039ABC1234",
  "rssi": "-48",
  "timestamp": 1736208003000,
  "firstSeen": true
}
```

**T=4000ms: Tag A detected again**
```
(No message sent - already seen)
```

**T=5000ms: Tag B detected again**
```
(No message sent - already seen)
```

**T=10000ms: Client sends clear command**
```
Client → Server: {"clearSeen": true}
```

**T=10001ms: Server acknowledges**
```json
{
  "type": "ack",
  "message": "seenTags cleared"
}
```

**T=11000ms: Tag A detected again (after clear)**
```json
{
  "type": "tag",
  "epc": "E28011700000020396ECAB9A",
  "rssi": "-46",
  "timestamp": 1736208011000,
  "firstSeen": true
}
```

---

## 💻 Client Code Examples

### JavaScript/HTML Client

```javascript
const ws = new WebSocket('ws://localhost:8081');
const tags = [];

ws.onopen = () => {
    console.log('Connected to RFID server');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
    
    if (data.type === 'welcome') {
        console.log('✅ ' + data.message);
    } 
    else if (data.type === 'tag') {
        // New RFID tag detected
        tags.push(data);
        console.log(`📡 Tag #${tags.length}: ${data.epc}`);
        console.log(`   Signal: ${data.rssi} dBm`);
        console.log(`   Time: ${new Date(data.timestamp).toLocaleTimeString()}`);
    }
    else if (data.type === 'ack') {
        console.log('✅ Server: ' + data.message);
    }
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from server');
};

// Function to clear server cache
function clearCache() {
    ws.send(JSON.stringify({clearSeen: true}));
}
```

### Python Client

```python
import websocket
import json
from datetime import datetime

tags = []

def on_message(ws, message):
    data = json.loads(message)
    print(f"Received: {data}")
    
    if data.get('type') == 'welcome':
        print(f"✅ {data['message']}")
    
    elif data.get('type') == 'tag':
        # New RFID tag detected
        tags.append(data)
        print(f"📡 Tag #{len(tags)}: {data['epc']}")
        print(f"   Signal: {data['rssi']} dBm")
        timestamp = datetime.fromtimestamp(data['timestamp'] / 1000)
        print(f"   Time: {timestamp.strftime('%H:%M:%S')}")
    
    elif data.get('type') == 'ack':
        print(f"✅ Server: {data['message']}")

def on_error(ws, error):
    print(f"Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("Disconnected from server")

def on_open(ws):
    print("Connected to RFID server")

# Connect to WebSocket
ws = websocket.WebSocketApp(
    "ws://localhost:8081",
    on_message=on_message,
    on_error=on_error,
    on_close=on_close,
    on_open=on_open
)

ws.run_forever()
```

### PHP Client

```php
<?php
require 'vendor/autoload.php';

use WebSocket\Client;

$client = new Client("ws://localhost:8081");

while (true) {
    $message = $client->receive();
    $data = json_decode($message, true);
    
    echo "Received: " . json_encode($data) . "\n";
    
    if (isset($data['type']) && $data['type'] === 'welcome') {
        echo "✅ " . $data['message'] . "\n";
    }
    elseif (isset($data['type']) && $data['type'] === 'tag') {
        echo "📡 Tag: " . $data['epc'] . "\n";
        echo "   Signal: " . $data['rssi'] . " dBm\n";
        echo "   Time: " . date('H:i:s', $data['timestamp'] / 1000) . "\n";
    }
    elseif (isset($data['type']) && $data['type'] === 'ack') {
        echo "✅ " . $data['message'] . "\n";
    }
}
?>
```

---

## 🔍 RSSI (Signal Strength) Reference

| RSSI Value | Distance | Quality |
|------------|----------|---------|
| -30 to -45 | Very close (< 1 meter) | Excellent |
| -45 to -55 | Close (1-3 meters) | Good |
| -55 to -65 | Medium (3-5 meters) | Fair |
| -65 to -75 | Far (5-8 meters) | Poor |
| -75 to -85 | Very far (8-10 meters) | Very Poor |

---

## ⚠️ Important Notes

1. **Each tag is sent only ONCE** - No duplicates unless cache is cleared
2. **Messages arrive sequentially** - One tag per ~200ms scan cycle
3. **Tags are NOT batched** - Each tag = separate JSON message
4. **firstSeen is always true** - Since each unique tag is sent only once
5. **Client must store tags** - Server doesn't send historical data
6. **Case sensitive EPCs** - Tag IDs are case-sensitive strings

---

## 🧪 Testing Tips

1. **Use a WebSocket testing tool** like:
   - Browser: [websocket.org/echo.html](https://www.websocket.org/echo.html)
   - Chrome Extension: "Simple WebSocket Client"
   - Command line: `wscat -c ws://localhost:8081`

2. **Test command**:
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:8081
   ```

3. **Expected output**:
   ```
   Connected to ws://localhost:8081
   < {"type":"welcome","message":"Connected to RFID WebSocket Server"}
   < {"type":"tag","epc":"E28011700000020396ECAB9A","rssi":"-45","timestamp":1736208000000,"firstSeen":true}
   ```

---

## 📞 Client → Server Commands

Send this to clear the tag cache:
```json
{"clearSeen": true}
```

Server will respond with:
```json
{
  "type": "ack",
  "message": "seenTags cleared"
}
```

---

Generated: January 6, 2026
