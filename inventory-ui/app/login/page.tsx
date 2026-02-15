"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { odooApi } from "@/lib/api";
import { Package2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    serverUrl: "",
    db: "",
    login: "",
    password: "",
  });

  // Check if already authenticated and redirect to dashboard
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check if user is already logged in
      if (odooApi.isAuthenticated()) {
        const user = odooApi.getUser();
        if (user) {
          console.log('User already authenticated, redirecting to dashboard');
          router.push("/dashboard");
          return;
        }
      }
      
      // Load saved configuration
      setFormData(prev => ({
        ...prev,
        serverUrl: localStorage.getItem("odoo_server_url") || "http://localhost:8069",
        db: localStorage.getItem("odoo_database") || "",
      }));
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Attempting login with:', { 
        serverUrl: formData.serverUrl, 
        db: formData.db, 
        login: formData.login 
      });
      
      const response = await odooApi.login(formData);
      console.log('Login response:', response);

      if (response.success && response.data) {
        toast({
          title: "Login Successful",
          description: `Welcome, ${response.data.user_name}!`,
        });
        router.push("/dashboard");
      } else {
        console.error('Login failed:', response.error);
        toast({
          title: "Login Failed",
          description: response.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Login exception:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <Package2 className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Inventory Mobile
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to manage your inventory operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                type="url"
                placeholder="http://localhost:8069"
                value={formData.serverUrl}
                onChange={(e) =>
                  setFormData({ ...formData, serverUrl: e.target.value })
                }
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db">Database</Label>
              <Input
                id="db"
                type="text"
                placeholder="your_database"
                value={formData.db}
                onChange={(e) =>
                  setFormData({ ...formData, db: e.target.value })
                }
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login">Email / Username</Label>
              <Input
                id="login"
                type="text"
                placeholder="user@example.com"
                value={formData.login}
                onChange={(e) =>
                  setFormData({ ...formData, login: e.target.value })
                }
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
