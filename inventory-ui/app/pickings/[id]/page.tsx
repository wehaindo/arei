"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { odooApi } from "@/lib/api";
import { PickingDetail } from "@/lib/types";
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
  User,
  ArrowRight,
} from "lucide-react";

export default function PickingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [picking, setPicking] = useState<PickingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);
  const [lotInput, setLotInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadPickingDetail();
  }, [router, params.id]);

  useEffect(() => {
    if (scanMode && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [scanMode]);

  const loadPickingDetail = async () => {
    setIsLoading(true);
    try {
      const response = await odooApi.getPickingDetail(Number(params.id));
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
        Number(params.id),
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
        Number(params.id),
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
      const response = await odooApi.validatePicking(Number(params.id));
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

  // Check if picking can be edited (not done or cancelled)
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {picking.name}
                </h1>
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
                    onClick={() => setScanMode(!scanMode)}
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    {scanMode ? "Manual" : "Scan"}
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Info Cards */}
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

        {/* Scan Mode Panel */}
        {scanMode && canEdit() && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5" />
                Scan Mode
              </CardTitle>
              <CardDescription>
                Scan product barcode or lot/serial number
              </CardDescription>
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
                <Button type="submit" className="w-full">
                  Process Scan
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Products List */}
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
                      <CardTitle className="text-lg">
                        {line.product_name}
                      </CardTitle>
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
                  {/* Expected vs Done */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Expected</p>
                      <p className="text-xl font-bold">
                        {line.quantity_expected} {line.uom}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Done</p>
                      <p className="text-xl font-bold text-green-600">
                        {line.quantity_done} {line.uom}
                      </p>
                    </div>
                  </div>

                  {/* Move Lines (Lots) */}
                  {line.move_lines && line.move_lines.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-semibold mb-2">Processed Lots/Serials:</p>
                      <div className="space-y-2">
                        {line.move_lines.map((ml) => (
                          <div
                            key={ml.id}
                            className="flex justify-between items-center bg-gray-50 p-2 rounded"
                          >
                            <span className="font-mono text-sm">
                              {ml.lot_name || "No lot"}
                            </span>
                            <span className="text-sm font-semibold">
                              {ml.quantity} {line.uom}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Input Section */}
                  {!scanMode && selectedMoveId === line.id && canEdit() && (
                    <div className="pt-4 border-t space-y-3 bg-blue-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">Add Quantity</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMoveId(null)}
                        >
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
                      <Button
                        onClick={() => handleManualAdd(line.id)}
                        className="w-full"
                      >
                        Add
                      </Button>
                    </div>
                  )}

                  {/* Add Button */}
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

                  {/* Locations */}
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
