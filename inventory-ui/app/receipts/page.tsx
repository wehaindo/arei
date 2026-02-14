"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { odooApi } from "@/lib/api";
import { Receipt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, PackageCheck, Calendar, MapPin } from "lucide-react";

export default function ReceiptsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadReceipts();
  }, [router]);

  const loadReceipts = async () => {
    setIsLoading(true);
    try {
      const response = await odooApi.listReceipts({ state: "assigned" });
      if (response.success && response.data) {
        setReceipts(response.data as Receipt[]);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load receipts",
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

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
              <p className="text-sm text-gray-600">Incoming Shipments</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-gray-600">Loading receipts...</p>
          </div>
        ) : receipts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageCheck className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No receipts found</h3>
              <p className="text-gray-600">
                There are no pending receipts at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {receipts.map((receipt) => (
              <Card
                key={receipt.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/receipts/${receipt.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{receipt.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {receipt.partner_name || "N/A"}
                      </CardDescription>
                    </div>
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                      {receipt.state}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {receipt.origin && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-medium">Origin:</span>
                        {receipt.origin}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(receipt.scheduled_date)}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {receipt.location_dest_name}
                    </div>
                    <div className="pt-2 border-t">
                      <span className="font-medium">{receipt.total_lines}</span>{" "}
                      line(s)
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
