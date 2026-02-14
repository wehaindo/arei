"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { odooApi } from "@/lib/api";
import { ReceiptDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Check, Package } from "lucide-react";

export default function ReceiptDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadReceiptDetail();
  }, [router, params.id]);

  const loadReceiptDetail = async () => {
    setIsLoading(true);
    try {
      const response = await odooApi.getReceiptDetail(Number(params.id));
      if (response.success && response.data) {
        setReceipt(response.data as ReceiptDetail);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load receipt details",
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

  const handleQuantityChange = async (moveId: number, quantity: number) => {
    try {
      const response = await odooApi.updateReceiptLine(
        Number(params.id),
        moveId,
        quantity
      );
      if (response.success) {
        toast({
          title: "Success",
          description: "Quantity updated",
        });
        loadReceiptDetail();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to update quantity",
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
      const response = await odooApi.validateReceipt(Number(params.id));
      if (response.success) {
        toast({
          title: "Success",
          description: "Receipt validated successfully",
        });
        router.push("/receipts");
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to validate receipt",
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Receipt not found</p>
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
                  {receipt.name}
                </h1>
                <p className="text-sm text-gray-600">{receipt.partner_name}</p>
              </div>
            </div>
            <Button onClick={handleValidate} disabled={isValidating}>
              <Check className="w-4 h-4 mr-2" />
              {isValidating ? "Validating..." : "Validate"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {receipt.lines.map((line) => (
            <Card key={line.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {line.product_name}
                      </CardTitle>
                      <CardDescription>
                        {line.product_code && `Code: ${line.product_code} | `}
                        {line.product_barcode && `Barcode: ${line.product_barcode}`}
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
                      <p className="text-xl font-bold">
                        {line.quantity_expected} {line.uom}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Done</p>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          value={line.quantity_done}
                          onChange={(e) =>
                            handleQuantityChange(
                              line.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24"
                          step="0.01"
                        />
                        <span className="text-sm text-gray-600">{line.uom}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-600">Destination</p>
                    <p className="font-medium">{line.location_dest_name}</p>
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
