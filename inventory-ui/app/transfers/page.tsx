"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { odooApi } from "@/lib/api";
import { Transfer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Package, Calendar, MapPin, ArrowRight } from "lucide-react";

export default function TransfersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadTransfers();
  }, [router]);

  const loadTransfers = async () => {
    setIsLoading(true);
    try {
      const response = await odooApi.listTransfers({ state: "assigned" });
      if (response.success && response.data) {
        setTransfers(response.data as Transfer[]);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load transfers",
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
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Internal Transfers</h1>
              <p className="text-sm text-gray-600">Move stock between locations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-gray-600">Loading transfers...</p>
          </div>
        ) : transfers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transfers found</h3>
              <p className="text-gray-600">
                There are no pending transfers at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {transfers.map((transfer) => (
              <Card
                key={transfer.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/transfers/${transfer.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{transfer.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {transfer.origin || "Internal Transfer"}
                      </CardDescription>
                    </div>
                    <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                      {transfer.state}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(transfer.scheduled_date)}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs">{transfer.location_name}</span>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs">{transfer.location_dest_name}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <span className="font-medium">{transfer.total_lines}</span>{" "}
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
