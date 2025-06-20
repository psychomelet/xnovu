import React from "react";
import { Body, Container, Head, Html, Preview, Tailwind } from "@react-email/components";
import { EmailHeader, EmailFooter } from "../components";

interface BasicEmailLayoutProps {
  children: React.ReactNode;
  subject: string;
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
  unsubscribeUrl?: string;
  footerNote?: string;
  containerStyle?: 'default' | 'minimal' | 'branded';
}

export const BasicEmailLayout = ({
  children,
  subject,
  organizationName,
  logoUrl,
  primaryColor = '#0066cc',
  unsubscribeUrl,
  footerNote,
  containerStyle = 'default'
}: BasicEmailLayoutProps) => {
  const containerClasses = {
    default: 'mx-auto max-w-2xl p-5',
    minimal: 'mx-auto max-w-lg py-10 px-5',
    branded: 'mx-auto max-w-2xl p-5'
  };

  const wrapperClasses = {
    default: '',
    minimal: '',
    branded: 'bg-white rounded-xl shadow-lg overflow-hidden'
  };

  const bodyClasses = {
    default: 'bg-white',
    minimal: 'bg-white',
    branded: 'bg-gray-100'
  };

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Tailwind>
        <Body className={`${bodyClasses[containerStyle]} font-sans`}>
          <Container className={containerClasses[containerStyle]}>
            <div className={wrapperClasses[containerStyle]}>
              <EmailHeader
                organizationName={organizationName}
                logoUrl={logoUrl}
                primaryColor={primaryColor}
              />
              
              {children}
              
              <EmailFooter
                organizationName={organizationName}
                unsubscribeUrl={unsubscribeUrl}
                footerNote={footerNote}
                primaryColor={primaryColor}
              />
            </div>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};