"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { odooApi } from "@/lib/api";
import { Picking } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
  Package,
  Calendar,
  MapPin,
  User,
  ChevronRight,
  FileText,
} from "lucide-react";

function PickingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [pickings, setPickings] = useState<Picking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pickingTypeId = searchParams.get("type");

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadPickings();
  }, [router, pickingTypeId]);

  const loadPickings = async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (pickingTypeId) {
        filters.picking_type_id = parseInt(pickingTypeId);
      }

      const response = await odooApi.listPickings(filters);
      if (response.success && response.data) {
        setPickings(response.data as Picking[]);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load pickings",
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "assigned":
        return "bg-blue-100 text-blue-800";
      case "done":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading operations...</p>
        </div>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/transactions")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {pickings[0]?.picking_type_name || "Operations"}
                </h1>
                <p className="text-sm text-gray-600">
                  {pickings.length} pending operation{pickings.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {pickings.map((picking) => (
            <Card
              key={picking.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/pickings/detail?id=${picking.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{picking.name}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        {picking.partner_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {picking.partner_name}
                          </span>
                        )}
                        {picking.origin && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {picking.origin}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStateColor(picking.state)}`}>
                    {picking.state}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(picking.scheduled_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{picking.location_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="truncate">{picking.location_dest_name}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {picking.move_count} product{picking.move_count !== 1 ? "s" : ""}
                  </span>
                  <Button variant="outline" size="sm" className="group">
                    Process
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {pickings.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Operations</h3>
              <p className="text-gray-600">
                There are no operations waiting to be processed
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push("/transactions")}
              >
                Back to Operations
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function PickingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PickingsContent />
    </Suspense>
  );
}
