"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { odooApi } from "@/lib/api";
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
  Package, 
  TrendingUp, 
  Calendar, 
  Clock, 
  ArrowRight,
  PackageOpen,
  Truck,
  RefreshCw
} from "lucide-react";

interface DashboardStats {
  todayPickings: number;
  todayReceipts: number;
  todayDeliveries: number;
  todayTransfers: number;
  nextPickings: number;
  totalProducts: number;
  pendingReceipts: number;
  pendingDeliveries: number;
  pendingTransfers: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    todayPickings: 0,
    todayReceipts: 0,
    todayDeliveries: 0,
    todayTransfers: 0,
    nextPickings: 0,
    totalProducts: 0,
    pendingReceipts: 0,
    pendingDeliveries: 0,
    pendingTransfers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userData = odooApi.getUser();
    if (!userData) {
      router.push("/login");
    } else {
      setUser(userData);
      loadDashboardData();
    }
  }, [router]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Use the new dashboard stats endpoint
      const response = await odooApi.getDashboardStats();
      
      if (response.success && response.data) {
        const data = response.data as any;
        setStats({
          todayPickings: data.today_pickings || 0,
          todayReceipts: data.today_receipts || 0,
          todayDeliveries: data.today_deliveries || 0,
          todayTransfers: data.today_transfers || 0,
          nextPickings: data.next_pickings || 0,
          totalProducts: data.total_products || 0,
          pendingReceipts: data.pending_receipts || 0,
          pendingDeliveries: data.pending_deliveries || 0,
          pendingTransfers: data.pending_transfers || 0,
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load dashboard data",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const formatDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Dashboard
              </h1>
              <p className="text-sm text-gray-600">{formatDate()}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={loadDashboardData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Welcome back, {user.user_name}!
          </h2>
          <p className="text-gray-600">{user.company_name}</p>
        </div>

        {/* Today's Summary */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Today&apos;s Operations
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Pickings</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.todayPickings}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Receipts</p>
                    <p className="text-3xl font-bold text-green-600">{stats.todayReceipts}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <PackageOpen className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Deliveries</p>
                    <p className="text-3xl font-bold text-orange-600">{stats.todayDeliveries}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Truck className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Transfers</p>
                    <p className="text-3xl font-bold text-purple-600">{stats.todayTransfers}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upcoming & Pending */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Upcoming Pickings
              </CardTitle>
              <CardDescription>Scheduled for tomorrow and beyond</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-blue-600">{stats.nextPickings}</p>
                  <p className="text-sm text-gray-600 mt-1">operations scheduled</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => router.push("/transactions")}
                >
                  View All
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Pending Operations
              </CardTitle>
              <CardDescription>Requires attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Receipts</span>
                  <span className="font-semibold text-green-600">{stats.pendingReceipts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Deliveries</span>
                  <span className="font-semibold text-orange-600">{stats.pendingDeliveries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Transfers</span>
                  <span className="font-semibold text-purple-600">{stats.pendingTransfers}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Navigate to common operations</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button 
              className="w-full justify-start h-auto py-4"
              variant="outline"
              onClick={() => router.push("/receipts")}
            >
              <PackageOpen className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Receipts</div>
                <div className="text-xs text-gray-600">Process incoming shipments</div>
              </div>
            </Button>
            
            <Button 
              className="w-full justify-start h-auto py-4"
              variant="outline"
              onClick={() => router.push("/deliveries")}
            >
              <Truck className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Deliveries</div>
                <div className="text-xs text-gray-600">Manage outgoing shipments</div>
              </div>
            </Button>
            
            <Button 
              className="w-full justify-start h-auto py-4"
              variant="outline"
              onClick={() => router.push("/transfers")}
            >
              <TrendingUp className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Internal Transfers</div>
                <div className="text-xs text-gray-600">Move stock between locations</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
