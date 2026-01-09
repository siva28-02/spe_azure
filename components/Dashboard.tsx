import React, { useMemo } from 'react';
import { SPEContainer } from '../types';
import { Folder } from 'lucide-react';

interface DashboardProps {
  containers: SPEContainer[];
  onViewAll: () => void;
  onSelectContainer: (container: SPEContainer) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ containers, onViewAll, onSelectContainer }) => {
  
  // Helper to format bytes to GB
  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return "-";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Page Title Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Overview of your SharePoint Embedded containers</p>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">All Containers</h3>
          <button 
            onClick={onViewAll} 
            className="text-sm text-brand-600 hover:text-brand-700 font-medium hover:underline"
          >
            View All
          </button>
        </div>

        {/* List Content */}
        <div className="divide-y divide-gray-100">
          {containers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No containers found.
            </div>
          ) : (
            containers.map((container) => {
              return (
                <div 
                  key={container.id} 
                  className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors cursor-pointer group"
                  onClick={() => onSelectContainer(container)}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="h-10 w-10 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center border border-brand-100 group-hover:bg-brand-100 transition-colors">
                      <Folder className="w-5 h-5" />
                    </div>
                    
                    {/* Text Info */}
                    <div>
                      <h4 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
                        {container.displayName}
                      </h4>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Created: {new Date(container.createdDateTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Right Side Info (Size) */}
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-600">
                      {formatSize(container.size)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
