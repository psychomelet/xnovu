import React from "react";
import { render, Section, Text, Heading } from "@react-email/components";
import { BasicEmailLayout } from "../layouts";
import { ActionButton } from "../components";

export interface MultiChannelEmailProps {
  // Basic email props
  subject: string;
  title: string;
  message: string;
  recipientName?: string;
  
  // CTA for single notifications
  ctaText?: string;
  ctaUrl?: string;
  
  // Template styling
  emailTemplate?: 'default' | 'minimal' | 'branded';
  primaryColor?: string;
  companyName: string;
  
  // Additional sections for digest or complex content
  additionalSections?: string[];
  
  // Digest-specific
  isDigested?: boolean;
  eventCount?: number;
}

export const MultiChannelEmailComponent = ({
  subject,
  title,
  message,
  recipientName,
  ctaText,
  ctaUrl,
  emailTemplate = 'default',
  primaryColor = '#0066cc',
  companyName,
  additionalSections,
  isDigested = false,
  eventCount
}: MultiChannelEmailProps) => {
  const emailContent = (
    <Section className="p-8">
      {recipientName && (
        <Text className="mb-5 text-gray-700">
          Hello {recipientName},
        </Text>
      )}
      
      <Heading as="h1" className="text-gray-900 mb-5 text-2xl font-bold">
        {title}
      </Heading>
      
      <Text className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
        {message}
      </Text>
      
      {/* Additional sections for digest content */}
      {additionalSections && additionalSections.map((section, index) => (
        <div 
          key={index}
          dangerouslySetInnerHTML={{ __html: section }}
          className="mb-6"
        />
      ))}
      
      {/* CTA only for single notifications */}
      {!isDigested && ctaText && ctaUrl && (
        <ActionButton
          text={ctaText}
          url={ctaUrl}
          backgroundColor={primaryColor}
        />
      )}
      
      {/* Digest summary */}
      {isDigested && eventCount && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <Text className="m-0 text-sm text-blue-700">
            This email contains {eventCount} notifications that were grouped together.
          </Text>
        </div>
      )}
    </Section>
  );

  return (
    <BasicEmailLayout
      subject={subject}
      organizationName={companyName}
      primaryColor={primaryColor}
      containerStyle={emailTemplate}
    >
      {emailContent}
    </BasicEmailLayout>
  );
};

export async function renderMultiChannelEmail(props: MultiChannelEmailProps): Promise<string> {
  return await render(<MultiChannelEmailComponent {...props} />);
}