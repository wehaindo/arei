"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { odooApi } from "@/lib/api";
import { Delivery } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, PackageMinus, Calendar, MapPin } from "lucide-react";

export default function DeliveriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadDeliveries();
  }, [router]);

  const loadDeliveries = async () => {
    setIsLoading(true);
    try {
      const response = await odooApi.listDeliveries({ state: "assigned" });
      if (response.success && response.data) {
        setDeliveries(response.data as Delivery[]);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load deliveries",
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
              <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
              <p className="text-sm text-gray-600">Outgoing Shipments</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-gray-600">Loading deliveries...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageMinus className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deliveries found</h3>
              <p className="text-gray-600">
                There are no pending deliveries at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deliveries.map((delivery) => (
              <Card
                key={delivery.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/deliveries/${delivery.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{delivery.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {delivery.partner_name || "N/A"}
                      </CardDescription>
                    </div>
                    <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      {delivery.state}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {delivery.origin && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-medium">Origin:</span>
                        {delivery.origin}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(delivery.scheduled_date)}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {delivery.location_name}
                    </div>
                    <div className="pt-2 border-t">
                      <span className="font-medium">{delivery.total_lines}</span>{" "}
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
