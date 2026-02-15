'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { odooApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  User, 
  LogOut, 
  Building2, 
  Database, 
  Server, 
  Mail,
  Shield
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [database, setDatabase] = useState("");

  useEffect(() => {
    const userData = odooApi.getUser();
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(userData);

    if (typeof window !== "undefined") {
      setServerUrl(localStorage.getItem("odoo_server_url") || "");
      setDatabase(localStorage.getItem("odoo_database") || "");
    }
  }, [router]);

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      odooApi.logout();
      router.push('/login');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* User Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">{user.user_name}</CardTitle>
                <CardDescription className="text-base">{user.login}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Email / Username</p>
                <p className="font-medium">{user.login}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Company</p>
                <p className="font-medium">{user.company_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">User ID</p>
                <p className="font-medium">{user.user_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Server Information</CardTitle>
            <CardDescription>Your connection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Server className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600">Server URL</p>
                <p className="font-medium break-all">{serverUrl}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Database className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Database</p>
                <p className="font-medium">{database}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="destructive" 
              className="w-full justify-start h-auto py-4"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Logout</div>
                <div className="text-xs opacity-90">Sign out from your account</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* App Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Inventory Mobile App</p>
          <p className="text-xs mt-1">Version 1.0.0</p>
        </div>
      </main>
    </div>
  );
}
