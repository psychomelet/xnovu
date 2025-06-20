import React from "react";
import { Heading } from "@react-email/components";

interface SafetyRemindersProps {
  title?: string;
  reminders: string[];
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  className?: string;
}

export const SafetyReminders = ({
  title = "Safety Reminders",
  reminders,
  backgroundColor = 'bg-green-50',
  borderColor = '#4CAF50',
  textColor = 'text-green-700',
  className = 'border-l-4 p-4 mb-5'
}: SafetyRemindersProps) => {
  return (
    <div 
      className={`${backgroundColor} ${className}`}
      style={{ borderLeftColor: borderColor }}
    >
      <Heading as="h3" className={`m-0 mb-2 ${textColor}`}>
        {title}
      </Heading>
      <ul className="m-0 pl-5">
        {reminders.map((reminder, index) => (
          <li key={index} className="mb-1">{reminder}</li>
        ))}
      </ul>
    </div>
  );
};