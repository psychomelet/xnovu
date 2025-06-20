import React from "react";
import { Section, Text } from "@react-email/components";

interface EmailFooterProps {
  organizationName: string;
  unsubscribeUrl?: string;
  footerNote?: string;
  primaryColor?: string;
  backgroundColor?: string;
  className?: string;
}

export const EmailFooter = ({
  organizationName,
  unsubscribeUrl,
  footerNote,
  primaryColor = '#0066cc',
  backgroundColor = 'bg-gray-50',
  className = "p-5 text-center border-t"
}: EmailFooterProps) => {
  return (
    <Section className={`${backgroundColor} ${className}`}>
      <Text className="text-xs text-gray-500 mb-2">
        &copy; {new Date().getFullYear()} {organizationName}. All rights reserved.
      </Text>
      {unsubscribeUrl && (
        <Text className="text-xs">
          <a href={unsubscribeUrl} className="no-underline" style={{ color: primaryColor }}>
            Unsubscribe from these emails
          </a>
        </Text>
      )}
      {footerNote && (
        <Text className="text-xs font-semibold mt-2" style={{ color: primaryColor }}>
          {footerNote}
        </Text>
      )}
    </Section>
  );
};