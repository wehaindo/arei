"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { odooApi } from "@/lib/api";
import { PickingDetail } from "@/lib/types";
import { RFIDReader, RFIDTag } from "@/lib/rfid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Check,
  Package,
  Scan,
  Plus,
  X,
  MapPin,
  Calendar,
  ArrowRight,
  Radio,
} from "lucide-react";

function PickingDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [picking, setPicking] = useState<PickingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [rfidMode, setRfidMode] = useState(false);
  const [isRfidScanning, setIsRfidScanning] = useState(false);
  const [rfidTags, setRfidTags] = useState<RFIDTag[]>([]);
  const [rfidTagMap, setRfidTagMap] = useState<Map<string, RFIDTag>>(new Map());
  const [maxRfidTags, setMaxRfidTags] = useState<number>(0); // 0 = unlimited
  const [barcode, setBarcode] = useState("");
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);
  const [lotInput, setLotInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const pickingId = searchParams.get("id");

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (pickingId) {
      loadPickingDetail();
    }
  }, [router, pickingId]);

  useEffect(() => {
    if (scanMode && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [scanMode]);

  const loadPickingDetail = async () => {
    if (!pickingId) return;
    setIsLoading(true);
    try {
      const response = await odooApi.getPickingDetail(Number(pickingId));
      if (response.success && response.data) {
        setPicking(response.data as PickingDetail);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load picking details",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    try {
      const response = await odooApi.scanPickingProduct(
        Number(pickingId),
        barcode,
        lotInput || undefined
      );

      if (response.success) {
        toast({
          title: "Success",
          description: "Product scanned successfully",
        });
        setBarcode("");
        setLotInput("");
        loadPickingDetail();
      } else if (response.error?.includes("required")) {
        toast({
          title: "Lot/Serial Required",
          description: response.error,
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to scan product",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleManualAdd = async (moveId: number) => {
    if (!qtyInput || parseFloat(qtyInput) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    const line = picking?.lines.find((l) => l.id === moveId);
    if (line?.tracking !== "none" && !lotInput.trim()) {
      toast({
        title: "Error",
        description: "Lot/Serial number is required for this product",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await odooApi.updatePickingLine(
        Number(pickingId),
        moveId,
        parseFloat(qtyInput),
        lotInput || undefined
      );

      if (response.success) {
        toast({
          title: "Success",
          description: "Quantity added",
        });
        setQtyInput("1");
        setLotInput("");
        setSelectedMoveId(null);
        loadPickingDetail();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to add quantity",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const response = await odooApi.validatePicking(Number(pickingId));
      if (response.success) {
        toast({
          title: "Success",
          description: "Operation validated successfully",
        });
        router.back();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to validate operation",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartRFIDScan = async () => {
    try {
      console.log('handleStartRFIDScan: Starting RFID scan');
      setRfidTags([]);
      setRfidTagMap(new Map());
      setIsRfidScanning(true);
      
      // Test if plugin is available
      if (RFIDReader.test) {
        const testResult = await RFIDReader.test();
        console.log('RFID plugin test:', testResult);
      }
      
      // Start listening for RFID tags
      console.log('Adding RFID listener');
      await RFIDReader.addListener('rfidTagRead', (tag: RFIDTag) => {
        console.log('RFID tag read:', tag);
        
        setRfidTagMap(prevMap => {
          const newMap = new Map(prevMap);
          
          // Check if we already have this EPC
          if (newMap.has(tag.epc)) {
            // Update existing tag (update RSSI and count)
            const existing = newMap.get(tag.epc)!;
            newMap.set(tag.epc, {
              ...existing,
              rssi: tag.rssi,
              count: (existing.count || 1) + 1
            });
          } else {
            // New unique tag
            if (maxRfidTags > 0 && newMap.size >= maxRfidTags) {
              console.log('Max tags reached, ignoring new tag:', tag.epc);
              return prevMap; // Don't add, we've reached the limit
            }
            newMap.set(tag.epc, { ...tag, count: 1 });
          }
          
          return newMap;
        });
        
        setRfidTags(prev => {
          const tagMap = new Map(prev.map(t => [t.epc, t]));
          
          if (tagMap.has(tag.epc)) {
            // Update existing
            const existing = tagMap.get(tag.epc)!;
            return prev.map(t => t.epc === tag.epc ? {
              ...existing,
              rssi: tag.rssi,
              count: (existing.count || 1) + 1
            } : t);
          } else {
            // New tag - check limit
            if (maxRfidTags > 0 && prev.length >= maxRfidTags) {
              console.log('Max tags reached, ignoring:', tag.epc);
              return prev;
            }
            return [...prev, { ...tag, count: 1 }];
          }
        });
      });

      console.log('Calling RFIDReader.startScan()');
      await RFIDReader.startScan();
      console.log('RFIDReader.startScan() completed');
      
      toast({
        title: "RFID Scanning Started",
        description: "Hold device near RFID tags",
      });
    } catch (error: any) {
      console.error('RFID scan error:', error);
      setIsRfidScanning(false);
      toast({
        title: "Error",
        description: error.message || "Failed to start RFID scan",
        variant: "destructive",
      });
      setIsRfidScanning(false);
    }
  };

  const handleStopRFIDScan = async () => {
    try {
      await RFIDReader.stopScan();
      await RFIDReader.removeAllListeners();
      setIsRfidScanning(false);
      
      toast({
        title: "RFID Scan Stopped",
        description: `Found ${rfidTags.length} tag(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to stop RFID scan",
        variant: "destructive",
      });
    }
  };

  const handleProcessRFIDTags = async () => {
    if (rfidTags.length === 0) {
      toast({
        title: "Error",
        description: "No RFID tags scanned",
        variant: "destructive",
      });
      return;
    }

    try {
      const tagEPCs = rfidTags.map(tag => tag.epc);
      const response = await odooApi.scanRFIDTags(Number(pickingId), tagEPCs);

      if (response.success) {
        toast({
          title: "Success",
          description: `Processed ${rfidTags.length} RFID tag(s)`,
        });
        setRfidTags([]);
        setRfidMode(false);
        loadPickingDetail();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to process RFID tags",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClearRFIDTags = () => {
    setRfidTags([]);
    setRfidTagMap(new Map());
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canEdit = () => {
    return picking && ['confirmed', 'waiting', 'assigned'].includes(picking.state);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!picking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Operation not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{picking.name}</h1>
                <p className="text-sm text-gray-600">
                  {picking.picking_type_name}
                  {picking.partner_name && ` • ${picking.partner_name}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {canEdit() && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setScanMode(!scanMode);
                      setRfidMode(false);
                    }}
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    {scanMode ? "Manual" : "Barcode"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setRfidMode(!rfidMode);
                      setScanMode(false);
                    }}
                  >
                    <Radio className="w-4 h-4 mr-2" />
                    {rfidMode ? "Manual" : "RFID"}
                  </Button>
                  <Button onClick={handleValidate} disabled={isValidating}>
                    <Check className="w-4 h-4 mr-2" />
                    {isValidating ? "Validating..." : "Validate"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 mb-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Scheduled</p>
                  <p className="font-semibold">{formatDate(picking.scheduled_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">From</p>
                  <p className="font-semibold text-sm">{picking.location_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">To</p>
                  <p className="font-semibold text-sm">{picking.location_dest_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {scanMode && canEdit() && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5" />
                Scan Mode
              </CardTitle>
              <CardDescription>Scan product barcode or lot/serial number</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScanBarcode} className="space-y-4">
                <div>
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    ref={barcodeInputRef}
                    id="barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or enter barcode..."
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="scanLot">Lot/Serial Number (if required)</Label>
                  <Input
                    id="scanLot"
                    value={lotInput}
                    onChange={(e) => setLotInput(e.target.value)}
                    placeholder="Enter lot/serial number..."
                  />
                </div>
                <Button type="submit" className="w-full">Process Scan</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {rfidMode && canEdit() && (
          <Card className="mb-6 border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5" />
                RFID Mode
              </CardTitle>
              <CardDescription>
                Scan RFID tags using Chainway C72 reader (single or batch)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {!isRfidScanning ? (
                  <Button 
                    onClick={handleStartRFIDScan} 
                    className="flex-1"
                    variant="default"
                  >
                    <Radio className="w-4 h-4 mr-2" />
                    Start RFID Scan
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStopRFIDScan} 
                    className="flex-1"
                    variant="destructive"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Stop Scanning
                  </Button>
                )}
              </div>

              {rfidTags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Scanned Tags ({rfidTags.length})</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearRFIDTags}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {rfidTags.map((tag, index) => (
                      <div 
                        key={index} 
                        className="flex justify-between items-center bg-white p-3 rounded border"
                      >
                        <div className="flex-1">
                          <p className="font-mono text-sm font-semibold">{tag.epc}</p>
                          <p className="text-xs text-gray-500">
                            RSSI: {tag.rssi} | Count: {tag.count}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={handleProcessRFIDTags} 
                    className="w-full"
                    disabled={isRfidScanning}
                  >
                    Process {rfidTags.length} Tag{rfidTags.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              )}

              {isRfidScanning && rfidTags.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Radio className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                  <p>Scanning for RFID tags...</p>
                  <p className="text-sm">Hold device near tags</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {picking.lines.map((line) => (
            <Card key={line.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{line.product_name}</CardTitle>
                      <CardDescription>
                        {line.product_code && `Code: ${line.product_code}`}
                        {line.product_barcode && ` | Barcode: ${line.product_barcode}`}
                        {line.tracking !== "none" && (
                          <span className="ml-2 text-orange-600 font-semibold">
                            | {line.tracking === "serial" ? "Serial" : "Lot"} Required
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Expected</p>
                      <p className="text-xl font-bold">{line.quantity_expected} {line.uom}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Done</p>
                      <p className="text-xl font-bold text-green-600">{line.quantity_done} {line.uom}</p>
                    </div>
                  </div>

                  {line.move_lines && line.move_lines.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-semibold mb-2">Processed Lots/Serials:</p>
                      <div className="space-y-2">
                        {line.move_lines.map((ml) => (
                          <div key={ml.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span className="font-mono text-sm">{ml.lot_name || "No lot"}</span>
                            <span className="text-sm font-semibold">{ml.quantity} {line.uom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!scanMode && selectedMoveId === line.id && canEdit() && (
                    <div className="pt-4 border-t space-y-3 bg-blue-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">Add Quantity</p>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedMoveId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor={`qty-${line.id}`}>
                          Quantity {line.tracking === "serial" && "(Must be 1)"}
                        </Label>
                        <Input
                          id={`qty-${line.id}`}
                          type="number"
                          step="0.01"
                          value={qtyInput}
                          onChange={(e) => setQtyInput(e.target.value)}
                          disabled={line.tracking === "serial"}
                        />
                      </div>
                      {line.tracking !== "none" && (
                        <div>
                          <Label htmlFor={`lot-${line.id}`}>
                            {line.tracking === "serial" ? "Serial Number" : "Lot Number"} *
                          </Label>
                          <Input
                            id={`lot-${line.id}`}
                            value={lotInput}
                            onChange={(e) => setLotInput(e.target.value)}
                            placeholder={`Enter ${line.tracking}...`}
                          />
                        </div>
                      )}
                      <Button onClick={() => handleManualAdd(line.id)} className="w-full">Add</Button>
                    </div>
                  )}

                  {!scanMode && selectedMoveId !== line.id && canEdit() && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedMoveId(line.id);
                        setQtyInput(line.tracking === "serial" ? "1" : "1");
                        setLotInput("");
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Quantity
                    </Button>
                  )}

                  <div className="pt-4 border-t flex items-center gap-4 text-sm">
                    <span className="text-gray-600">{line.location_name}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{line.location_dest_name}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function PickingDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <PickingDetailContent />
    </Suspense>
  );
}
