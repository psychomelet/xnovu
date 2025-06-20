import React from "react";
import { Heading, Text } from "@react-email/components";

interface AlertSectionProps {
  title: string;
  message: string;
  color?: string;
  backgroundColor?: string;
  variant?: 'warning' | 'danger' | 'info' | 'success';
  className?: string;
}

const variantStyles = {
  warning: {
    backgroundColor: 'bg-orange-50',
    borderColor: '#FF6F00',
    textColor: 'text-orange-700'
  },
  danger: {
    backgroundColor: 'bg-red-50',
    borderColor: '#D32F2F',
    textColor: 'text-red-700'
  },
  info: {
    backgroundColor: 'bg-blue-50',
    borderColor: '#2196F3',
    textColor: 'text-blue-700'
  },
  success: {
    backgroundColor: 'bg-green-50',
    borderColor: '#4CAF50',
    textColor: 'text-green-700'
  }
};

export const AlertSection = ({
  title,
  message,
  color,
  backgroundColor,
  variant = 'info',
  className = "border-l-4 p-4 mb-5"
}: AlertSectionProps) => {
  const variantStyle = variantStyles[variant];
  const finalBackgroundColor = backgroundColor || variantStyle.backgroundColor;
  const borderColor = color || variantStyle.borderColor;
  const textColor = color || variantStyle.textColor;

  return (
    <div 
      className={`${finalBackgroundColor} ${className}`} 
      style={{ borderLeftColor: borderColor }}
    >
      <Heading as="h3" className={`m-0 mb-2 ${textColor}`}>
        {title}
      </Heading>
      <Text className="m-0 font-semibold whitespace-pre-wrap">
        {message}
      </Text>
    </div>
  );
};