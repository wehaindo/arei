"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { odooApi } from "@/lib/api";
import { OperationType } from "@/lib/types";
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
  PackageMinus,
  PackagePlus,
  ArrowRightLeft,
  ChevronRight,
} from "lucide-react";

export default function TransactionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!odooApi.isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadOperationTypes();
  }, [router]);

  const loadOperationTypes = async () => {
    setIsLoading(true);
    try {
      const response = await odooApi.getOperationTypes();
      if (response.success && response.data) {
        setOperationTypes(response.data as OperationType[]);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load operation types",
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

  const getIconForCode = (code: string) => {
    switch (code) {
      case "incoming":
        return <PackagePlus className="w-8 h-8" />;
      case "outgoing":
        return <PackageMinus className="w-8 h-8" />;
      case "internal":
        return <ArrowRightLeft className="w-8 h-8" />;
      default:
        return <Package className="w-8 h-8" />;
    }
  };

  const getColorClass = (code: string) => {
    switch (code) {
      case "incoming":
        return "bg-blue-50 text-blue-600 border-blue-200";
      case "outgoing":
        return "bg-green-50 text-green-600 border-green-200";
      case "internal":
        return "bg-purple-50 text-purple-600 border-purple-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Warehouse Operations
              </h1>
              <p className="text-sm text-gray-600">
                Select an operation type to view and process
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {operationTypes.map((type) => (
            <Card
              key={type.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2"
              onClick={() => router.push(`/pickings?type=${type.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div
                    className={`p-3 rounded-lg ${getColorClass(type.code)}`}
                  >
                    {getIconForCode(type.code)}
                  </div>
                  {type.pending_count > 0 && (
                    <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {type.pending_count}
                    </div>
                  )}
                </div>
                <CardTitle className="text-xl mt-4">{type.name}</CardTitle>
                <CardDescription>
                  {type.warehouse_name && `${type.warehouse_name}`}
                  {type.pending_count > 0
                    ? ` • ${type.pending_count} pending`
                    : " • No pending operations"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full group">
                  View Operations
                  <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {operationTypes.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Operations Found</h3>
              <p className="text-gray-600">
                No operation types are configured in your system
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
