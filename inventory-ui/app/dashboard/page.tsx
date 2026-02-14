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
import { Package, PackageCheck, PackageMinus, LogOut, User } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = odooApi.getUser();
    if (!userData) {
      router.push("/login");
    } else {
      setUser(userData);
    }
  }, [router]);

  const handleLogout = () => {
    odooApi.logout();
    router.push("/login");
  };

  if (!user) {
    return null;
  }

  const operations = [
    {
      title: "Receipts",
      description: "Manage incoming shipments",
      icon: PackageCheck,
      href: "/receipts",
      color: "bg-green-500",
    },
    {
      title: "Deliveries",
      description: "Process outgoing shipments",
      icon: PackageMinus,
      href: "/deliveries",
      color: "bg-blue-500",
    },
    {
      title: "Transfers",
      description: "Handle internal transfers",
      icon: Package,
      href: "/transfers",
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Inventory Mobile
              </h1>
              <p className="text-sm text-gray-600">{user.company_name}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4" />
                  {user.user_name}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back!
          </h2>
          <p className="text-gray-600">
            Select an operation to get started
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {operations.map((operation) => {
            const Icon = operation.icon;
            return (
              <Card
                key={operation.title}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(operation.href)}
              >
                <CardHeader>
                  <div
                    className={`w-12 h-12 ${operation.color} rounded-lg flex items-center justify-center mb-4`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>{operation.title}</CardTitle>
                  <CardDescription>{operation.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Open
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
