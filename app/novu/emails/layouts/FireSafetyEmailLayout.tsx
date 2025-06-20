import React from "react";
import { Body, Container, Head, Html, Preview, Tailwind, Section, Heading, Text } from "@react-email/components";
import { EmailHeader, EmailFooter } from "../components";

interface FireSafetyEmailLayoutProps {
  children: React.ReactNode;
  subject: string;
  organizationName: string;
  logoUrl?: string;
  emergencyColor: string;
  urgencyBadge?: string;
  emergencyTitle: string;
  emergencySubtitle?: string;
  footerNote?: string;
}

export const FireSafetyEmailLayout = ({
  children,
  subject,
  organizationName,
  logoUrl,
  emergencyColor,
  urgencyBadge,
  emergencyTitle,
  emergencySubtitle,
  footerNote
}: FireSafetyEmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto max-w-2xl p-5">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <EmailHeader
                organizationName={organizationName}
                logoUrl={logoUrl}
                primaryColor={emergencyColor}
                borderColor={emergencyColor}
              />

              {/* Emergency Alert Header */}
              <Section className="text-center py-8 px-8 bg-gradient-to-r from-red-50 to-orange-50">
                {urgencyBadge && (
                  <div 
                    dangerouslySetInnerHTML={{ __html: urgencyBadge }}
                    className="mb-4"
                  />
                )}
                <Heading as="h2" className="m-0 mb-2 text-3xl" style={{ color: emergencyColor }}>
                  {emergencyTitle}
                </Heading>
                {emergencySubtitle && (
                  <Text className="m-0 text-gray-600 text-sm">
                    {emergencySubtitle}
                  </Text>
                )}
              </Section>
              
              {children}
              
              <EmailFooter
                organizationName={organizationName}
                footerNote={footerNote}
                primaryColor={emergencyColor}
              />
            </div>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};