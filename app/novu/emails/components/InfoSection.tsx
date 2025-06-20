import React from "react";
import { Heading, Text } from "@react-email/components";

interface InfoSectionProps {
  title: string;
  content: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  className?: string;
  borderVariant?: 'left' | 'full';
}

export const InfoSection = ({
  title,
  content,
  backgroundColor = 'bg-gray-50',
  borderColor = '#e5e7eb',
  textColor = 'text-gray-700',
  className = 'p-4 mb-5',
  borderVariant = 'full'
}: InfoSectionProps) => {
  const borderClass = borderVariant === 'left' ? 'border-l-4' : 'border border-gray-300 rounded';
  const borderStyle = borderVariant === 'left' ? { borderLeftColor: borderColor } : { borderColor };

  return (
    <div 
      className={`${backgroundColor} ${borderClass} ${className}`}
      style={borderStyle}
    >
      <Heading as="h3" className={`m-0 mb-2 ${textColor}`}>
        {title}
      </Heading>
      <Text className="m-0 whitespace-pre-wrap">
        {content}
      </Text>
    </div>
  );
};