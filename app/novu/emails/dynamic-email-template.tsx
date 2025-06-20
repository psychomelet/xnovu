import {
  Body,
  Container,
  Head,
  Html,
  render,
  Text,
  Heading,
  Hr,
  Section,
  Img,
  Link,
} from '@react-email/components';
import * as React from "react";

interface DynamicEmailTemplateProps {
  subject?: string;
  body: string;
  companyName?: string;
  primaryColor?: string;
  variables?: Record<string, any>;
  emailSettings?: {
    templateStyle?: 'default' | 'minimal' | 'branded';
    showHeader?: boolean;
    showFooter?: boolean;
    headerLogoUrl?: string;
    unsubscribeUrl?: string;
  };
}

export const DynamicEmailTemplate = ({
  subject,
  body,
  companyName = 'XNovu',
  primaryColor = '#0066cc',
  variables = {},
  emailSettings = {
    templateStyle: 'default',
    showHeader: true,
    showFooter: true,
  }
}: DynamicEmailTemplateProps) => {
  const currentYear = new Date().getFullYear();

  // Parse body as HTML and render safely
  const renderBody = () => {
    return { __html: body };
  };

  // Render based on template style
  const renderContent = () => {
    switch (emailSettings.templateStyle) {
      case 'minimal':
        return (
          <Container
            style={{
              fontFamily: 'system-ui, sans-serif',
              maxWidth: '500px',
              margin: '0 auto',
              padding: '40px 20px',
            }}
          >
            <div dangerouslySetInnerHTML={renderBody()} />
          </Container>
        );

      case 'branded':
        return (
          <Container
            style={{
              background: '#f5f5f5',
              padding: '40px 20px',
            }}
          >
            <Section
              style={{
                maxWidth: '600px',
                margin: '0 auto',
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
            >
              {emailSettings.showHeader && (
                <Section
                  style={{
                    background: primaryColor,
                    color: 'white',
                    padding: '30px',
                    textAlign: 'center' as const,
                  }}
                >
                  {emailSettings.headerLogoUrl ? (
                    <Img
                      src={emailSettings.headerLogoUrl}
                      alt={companyName}
                      style={{ maxHeight: '40px', margin: '0 auto' }}
                    />
                  ) : (
                    <Heading
                      as="h1"
                      style={{
                        margin: '0',
                        color: 'white',
                        fontSize: '24px',
                      }}
                    >
                      {companyName}
                    </Heading>
                  )}
                </Section>
              )}
              
              <Section style={{ padding: '40px' }}>
                <div dangerouslySetInnerHTML={renderBody()} />
              </Section>
              
              {emailSettings.showFooter && (
                <Section
                  style={{
                    background: '#f9f9f9',
                    padding: '20px',
                    textAlign: 'center' as const,
                    fontSize: '12px',
                    color: '#666',
                  }}
                >
                  <Text style={{ margin: '0' }}>
                    &copy; {currentYear} {companyName}
                  </Text>
                  {emailSettings.unsubscribeUrl && (
                    <Text style={{ margin: '10px 0 0 0' }}>
                      <Link
                        href={emailSettings.unsubscribeUrl}
                        style={{ color: '#666', textDecoration: 'underline' }}
                      >
                        Unsubscribe
                      </Link>
                    </Text>
                  )}
                </Section>
              )}
            </Section>
          </Container>
        );

      default: // 'default'
        return (
          <Container
            style={{
              fontFamily: 'Arial, sans-serif',
              maxWidth: '600px',
              margin: '0 auto',
              padding: '20px',
            }}
          >
            <Section
              style={{
                background: 'white',
                padding: '30px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {emailSettings.showHeader && (
                <>
                  {emailSettings.headerLogoUrl ? (
                    <Section style={{ textAlign: 'center' as const, marginBottom: '20px' }}>
                      <Img
                        src={emailSettings.headerLogoUrl}
                        alt={companyName}
                        style={{ maxHeight: '50px' }}
                      />
                    </Section>
                  ) : (
                    <Heading
                      as="h1"
                      style={{
                        color: primaryColor,
                        textAlign: 'center' as const,
                        margin: '0 0 20px 0',
                        fontSize: '28px',
                      }}
                    >
                      {companyName}
                    </Heading>
                  )}
                </>
              )}
              
              <div dangerouslySetInnerHTML={renderBody()} />
              
              {emailSettings.showFooter && (
                <>
                  <Hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #eee' }} />
                  <Text
                    style={{
                      textAlign: 'center' as const,
                      fontSize: '12px',
                      color: '#666',
                      margin: '0',
                    }}
                  >
                    &copy; {currentYear} {companyName}. All rights reserved.
                  </Text>
                  {emailSettings.unsubscribeUrl && (
                    <Text
                      style={{
                        textAlign: 'center' as const,
                        fontSize: '12px',
                        color: '#666',
                        margin: '10px 0 0 0',
                      }}
                    >
                      <Link
                        href={emailSettings.unsubscribeUrl}
                        style={{ color: '#666', textDecoration: 'underline' }}
                      >
                        Unsubscribe
                      </Link>
                    </Text>
                  )}
                </>
              )}
            </Section>
          </Container>
        );
    }
  };

  return (
    <Html>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{subject || 'Notification'}</title>
      </Head>
      <Body style={{ margin: '0', padding: '0', backgroundColor: '#f5f5f5' }}>
        {renderContent()}
      </Body>
    </Html>
  );
};

export default DynamicEmailTemplate;

export function renderDynamicEmail(props: DynamicEmailTemplateProps): Promise<string> {
  return render(<DynamicEmailTemplate {...props} />);
}