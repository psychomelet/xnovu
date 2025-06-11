import React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';
import { getTemplateRenderer } from './TemplateRenderer';

interface TemplateAwareEmailProps {
  subject?: string;
  body: string;
  enterpriseId: string;
  variables: Record<string, any>;
  showHeader?: boolean;
  preview?: string;
}

/**
 * Template-aware email component that processes xnovu_render syntax
 */
export const TemplateAwareEmail = ({
  subject,
  body,
  enterpriseId,
  variables,
  showHeader = true,
  preview,
}: TemplateAwareEmailProps) => {
  const [renderedBody, setRenderedBody] = React.useState<string>('');
  const [renderedSubject, setRenderedSubject] = React.useState<string>(subject || '');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const renderTemplate = async () => {
      try {
        const renderer = getTemplateRenderer();
        const context = { enterpriseId, variables };

        // Render body
        const processedBody = await renderer.render(body, context);
        setRenderedBody(processedBody);

        // Render subject if provided
        if (subject) {
          const processedSubject = await renderer.render(subject, context);
          setRenderedSubject(processedSubject);
        }

        setError(null);
      } catch (err) {
        console.error('[TemplateAwareEmail] Rendering error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setRenderedBody(body); // Fallback to original body
        setRenderedSubject(subject || '');
      }
    };

    renderTemplate();
  }, [body, subject, enterpriseId, variables]);

  if (error) {
    return (
      <Html>
        <Head />
        <Preview>Template Error</Preview>
        <Body>
          <Container>
            <Text style={{ color: 'red', fontSize: '14px' }}>
              Template rendering error: {error}
            </Text>
            <Text style={{ fontSize: '12px', color: '#666' }}>
              Original content:
            </Text>
            <Text style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              {body}
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  return (
    <Html>
      <Head />
      <Preview>{preview || renderedSubject}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: '#2250f4',
                offwhite: '#fafbfb',
                blurwhite: '#f3f3f5',
              },
              spacing: {
                0: '0px',
                20: '20px',
                45: '45px',
              },
            },
          },
        }}
      >
        <Body className="bg-blurwhite text-base font-sans">
          {showHeader && (
            <Section className="text-center py-20">
              <Text className="text-2xl font-bold text-brand">
                Smart Building Notifications
              </Text>
            </Section>
          )}

          <Container className="bg-white p-45">
            <Section>
              {/* Render the processed template body as HTML */}
              <div dangerouslySetInnerHTML={{ __html: renderedBody }} />
            </Section>
          </Container>

          <Container className="mt-20">
            <Text className="text-center text-gray-400 mb-45">
              Powered by XNovu Smart Building Notification System
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

/**
 * Render template-aware email to HTML string
 */
export async function renderTemplateAwareEmail(
  template: string,
  enterpriseId: string,
  variables: Record<string, any>,
  options: {
    subject?: string;
    showHeader?: boolean;
    preview?: string;
  } = {}
): Promise<string> {
  const { render } = await import('@react-email/components');
  
  return render(
    <TemplateAwareEmail
      body={template}
      enterpriseId={enterpriseId}
      variables={variables}
      subject={options.subject}
      showHeader={options.showHeader}
      preview={options.preview}
    />
  );
}

/**
 * Server-side template rendering for workflow usage
 */
export async function renderTemplateForWorkflow(
  template: string,
  enterpriseId: string,
  variables: Record<string, any>
): Promise<{ subject?: string; body: string }> {
  try {
    const renderer = getTemplateRenderer();
    const context = { enterpriseId, variables };

    // For workflow usage, we expect the template to be a complete email template
    // or we can parse it to separate subject and body
    let subject: string | undefined;
    let body = template;

    // Check if template has subject line (look for first line starting with "Subject:")
    const lines = template.split('\n');
    if (lines[0]?.toLowerCase().startsWith('subject:')) {
      subject = lines[0].substring(8).trim(); // Remove "Subject:" prefix
      body = lines.slice(1).join('\n').trim();
    }

    // Render both subject and body
    const renderedBody = await renderer.render(body, context);
    const renderedSubject = subject ? await renderer.render(subject, context) : undefined;

    return {
      subject: renderedSubject,
      body: renderedBody
    };
  } catch (error) {
    console.error('[renderTemplateForWorkflow] Error:', error);
    throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}