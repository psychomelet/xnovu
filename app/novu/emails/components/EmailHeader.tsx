import React from "react";
import { Heading, Img, Section } from "@react-email/components";

interface EmailHeaderProps {
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
  borderColor?: string;
  className?: string;
}

export const EmailHeader = ({
  organizationName,
  logoUrl,
  primaryColor = '#0066cc',
  borderColor,
  className = "text-center py-5 px-8 border-b border-gray-200"
}: EmailHeaderProps) => {
  const headerStyle = borderColor ? { borderBottomColor: borderColor } : undefined;
  const finalClassName = borderColor ? `${className.replace('border-gray-200', 'border-b-4')}` : className;

  return (
    <Section className={finalClassName} style={headerStyle}>
      {logoUrl && (
        <Img
          src={logoUrl}
          alt={organizationName}
          className="max-h-12 mx-auto mb-2"
        />
      )}
      <Heading as="h1" className="m-0 text-2xl" style={{ color: primaryColor }}>
        {organizationName}
      </Heading>
    </Section>
  );
};