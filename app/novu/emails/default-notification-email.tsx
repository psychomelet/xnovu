import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  render,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface DefaultNotificationEmailProps {
  subject: string;
  recipientName?: string;
  title: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
  footer?: string;
  templateStyle?: 'default' | 'minimal' | 'branded';
  showHeader?: boolean;
  showFooter?: boolean;
  primaryColor?: string;
  headerLogoUrl?: string;
  companyName?: string;
  unsubscribeUrl?: string;
}

export const DefaultNotificationEmail = ({
  subject,
  recipientName,
  title,
  message,
  ctaText,
  ctaUrl,
  footer,
  templateStyle = 'default',
  showHeader = true,
  showFooter = true,
  primaryColor = '#0066cc',
  headerLogoUrl,
  companyName = 'XNovu',
  unsubscribeUrl,
}: DefaultNotificationEmailProps) => {
  const isMinimal = templateStyle === 'minimal';
  const isBranded = templateStyle === 'branded';

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Tailwind>
        <Body className={isBranded ? "bg-gray-100" : "bg-white"}>
          <Container className={`mx-auto ${isMinimal ? 'max-w-lg py-10 px-5' : 'max-w-2xl p-5'}`}>
            <div className={isBranded ? "bg-white rounded-xl shadow-lg overflow-hidden" : ""}>
              
              {/* Header */}
              {showHeader && (
                <Section className={isBranded ? `bg-[${primaryColor}] text-white p-8 text-center` : "text-center py-5 border-b border-gray-200"}>
                  {headerLogoUrl ? (
                    <Img
                      src={headerLogoUrl}
                      alt={companyName}
                      className="max-h-12 mx-auto"
                    />
                  ) : (
                    <Heading 
                      as="h2" 
                      className={`m-0 ${isBranded ? 'text-white' : `text-[${primaryColor}]`}`}
                    >
                      {companyName}
                    </Heading>
                  )}
                </Section>
              )}

              {/* Main Content */}
              <Section className={isMinimal ? "py-0" : "p-8"}>
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
                  <Section className="text-center my-8">
                    <Button
                      href={ctaUrl}
                      className={`bg-[${primaryColor}] text-white px-6 py-3 rounded-md font-semibold no-underline inline-block`}
                    >
                      {ctaText}
                    </Button>
                  </Section>
                )}
                
                {footer && (
                  <Text className="mt-8 text-gray-600 text-sm">
                    {footer}
                  </Text>
                )}
              </Section>

              {/* Footer */}
              {showFooter && (
                <Section className={isBranded ? "bg-gray-50 p-5 text-center" : "mt-10 pt-5 border-t border-gray-200 text-center"}>
                  <Text className="text-xs text-gray-500 mb-2">
                    &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
                  </Text>
                  {unsubscribeUrl && (
                    <Text className="text-xs">
                      <a href={unsubscribeUrl} className={`text-[${primaryColor}] no-underline`}>
                        Unsubscribe from these emails
                      </a>
                    </Text>
                  )}
                </Section>
              )}
            </div>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DefaultNotificationEmail;

export function renderEmail(props: DefaultNotificationEmailProps) {
  return render(<DefaultNotificationEmail {...props} />);
}