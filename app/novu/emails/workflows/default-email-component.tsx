import React from "react";
import { render, Section, Text, Heading } from "@react-email/components";
import { BasicEmailLayout } from "../layouts";
import { ActionButton } from "../components";

export interface DefaultEmailProps {
  // Required fields
  subject: string;
  title: string;
  message: string;
  
  // Optional fields
  recipientName?: string;
  ctaText?: string;
  ctaUrl?: string;
  footer?: string;
  
  // Template styling
  templateStyle?: 'default' | 'minimal' | 'branded';
  showHeader?: boolean;
  showFooter?: boolean;
  primaryColor?: string;
  headerLogoUrl?: string;
  companyName?: string;
  unsubscribeUrl?: string;
}

export const DefaultEmailComponent = ({
  subject,
  title,
  message,
  recipientName,
  ctaText,
  ctaUrl,
  footer,
  templateStyle = 'default',
  showHeader = true,
  showFooter = true,
  primaryColor = '#0066cc',
  headerLogoUrl,
  companyName = 'XNovu',
  unsubscribeUrl
}: DefaultEmailProps) => {
  const emailContent = (
    <Section className={templateStyle === 'minimal' ? 'py-0' : 'p-8'}>
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
      
      {ctaText && ctaUrl && (
        <ActionButton
          text={ctaText}
          url={ctaUrl}
          backgroundColor={primaryColor}
        />
      )}
      
      {footer && (
        <Text className="mt-8 text-gray-600 text-sm">
          {footer}
        </Text>
      )}
    </Section>
  );

  return (
    <BasicEmailLayout
      subject={subject}
      organizationName={companyName}
      logoUrl={headerLogoUrl}
      primaryColor={primaryColor}
      unsubscribeUrl={unsubscribeUrl}
      containerStyle={templateStyle}
    >
      {emailContent}
    </BasicEmailLayout>
  );
};

export async function renderDefaultEmail(props: DefaultEmailProps): Promise<string> {
  return await render(<DefaultEmailComponent {...props} />);
}