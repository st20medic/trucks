import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/firebase';
import { Printer, Download, FileText, LogOut } from 'lucide-react';

interface HeaderProps {
  onPrint?: () => void;
  onExport?: () => void;
  onReports?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onPrint, onExport, onReports }) => {
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="bg-white shadow-md border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Title */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-ems-blue">
              Lincoln EMS - Truck Tracker
            </h1>
          </div>

          {/* Right side - User info and actions */}
          <div className="flex items-center space-x-4">
            {/* User info */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user?.email}</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-2">
              {onPrint && (
                <button
                  onClick={onPrint}
                  className="btn-secondary flex items-center"
                  title="Print"
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </button>
              )}
              
              {onExport && (
                <button
                  onClick={onExport}
                  className="btn-secondary flex items-center"
                  title="Export Data"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </button>
              )}
              
              {onReports && (
                <button
                  onClick={onReports}
                  className="btn-secondary flex items-center"
                  title="Reports"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Reports
                </button>
              )}

              {/* Logout button */}
              <button
                onClick={handleSignOut}
                className="btn-danger flex items-center"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
