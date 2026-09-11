import React from "react";

interface SidebarProps {
  children: React.ReactNode;
  className?: string;
}

interface SidebarItemProps {
  children: React.ReactNode;
  href?: string;
  active?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function Sidebar({ children, className = "" }: SidebarProps) {
  return (
    <div className={`w-64 bg-gray-900 text-white min-h-screen ${className}`}>
      <div className="p-6">
        <h2 className="text-xl font-bold text-white mb-8">Encreasl Admin</h2>
        <nav className="space-y-2">
          {children}
        </nav>
      </div>
    </div>
  );
}

export function SidebarItem({ 
  children, 
  href = "#", 
  active = false, 
  icon, 
  className = "" 
}: SidebarItemProps) {
  const baseClasses = "flex items-center px-4 py-3 rounded-lg transition-colors";
  const activeClasses = active 
    ? "bg-blue-600 text-white" 
    : "text-gray-300 hover:bg-gray-800 hover:text-white";

  return (
    <a 
      href={href} 
      className={`${baseClasses} ${activeClasses} ${className}`}
    >
      {icon && <span className="mr-3">{icon}</span>}
      {children}
    </a>
  );
}
