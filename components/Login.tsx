import React from 'react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import { Database, ShieldCheck } from 'lucide-react';
import { Button } from './Button';

export const Login: React.FC = () => {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error(e);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-brand-600 p-8 text-center">
            <div className="h-16 w-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm mb-4">
                <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SharePoint Embedded</h1>
            <p className="text-brand-100 mt-2 text-sm">Document Management System</p>
        </div>
        
        <div className="p-8">
            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                    <div className="mt-1 bg-green-100 p-1 rounded-full">
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Secure Access</h3>
                        <p className="text-xs text-gray-500">Authenticated via Azure Active Directory</p>
                    </div>
                </div>
                 <div className="flex items-start gap-3">
                    <div className="mt-1 bg-blue-100 p-1 rounded-full">
                        <Database className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Container Management</h3>
                        <p className="text-xs text-gray-500">Create, delete and manage storage containers</p>
                    </div>
                </div>
            </div>

            <Button onClick={handleLogin} className="w-full" size="lg">
                Sign In with Microsoft
            </Button>
            
            <p className="text-center text-xs text-gray-400 mt-6">
                © 2024 Datacloud32 Inc.
            </p>
        </div>
      </div>
    </div>
  );
};
