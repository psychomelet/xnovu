import React from "react";
import { Heading, Text } from "@react-email/components";

interface DetailsListProps {
  title: string;
  details: Record<string, string>;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  className?: string;
}

export const DetailsList = ({
  title,
  details,
  backgroundColor = 'bg-blue-50',
  borderColor = '#2196F3',
  textColor = 'text-blue-700',
  className = 'border border-blue-300 rounded p-4 mb-5'
}: DetailsListProps) => {
  return (
    <div className={`${backgroundColor} ${className}`}>
      <Heading as="h3" className={`m-0 mb-2 ${textColor}`}>
        {title}
      </Heading>
      {Object.entries(details).map(([key, value]) => (
        <Text key={key} className="m-0 my-1">
          <strong>{key}:</strong> {value}
        </Text>
      ))}
    </div>
  );
};