import React from 'react';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface LoadingFallbackProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: string;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  icon: Icon,
  title,
  description,
  iconColor = "text-blue-600"
}) => {
  return (
    <Card className="p-8">
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-border border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2 font-sans">{title}</h3>
          <p className="text-muted-foreground text-sm font-serif">{description}</p>
        </div>
      </div>
    </Card>
  );
};

export default LoadingFallback;