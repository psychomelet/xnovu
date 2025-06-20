import React from "react";
import { render, Section, Text, Heading } from "@react-email/components";
import { BasicEmailLayout } from "../layouts";
import { InfoSection, DetailsList, ActionButton, AlertSection } from "../components";

export interface FireAssessmentEmailProps {
  subject: string;
  recipientName?: string;
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
  
  // Assessment details
  assessmentTitle: string;
  assessmentMessage: string;
  assessmentType?: string;
  dueDate?: string;
  assessor?: string;
  
  // Risk findings
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  riskFindings?: string[];
  recommendations?: string[];
  
  // Areas assessed
  areasAssessed?: string[];
  complianceStatus?: Record<string, string>;
  
  // Actions required
  immediateActions?: string[];
  actionDeadline?: string;
  
  // Actions
  reportUrl?: string;
  actionPlanUrl?: string;
  
  // Footer
  footerNote?: string;
}

export const FireAssessmentEmailComponent = ({
  subject,
  recipientName,
  organizationName,
  logoUrl,
  primaryColor = '#9C27B0',
  assessmentTitle,
  assessmentMessage,
  assessmentType,
  dueDate,
  assessor,
  riskLevel,
  riskFindings,
  recommendations,
  areasAssessed,
  complianceStatus,
  immediateActions,
  actionDeadline,
  reportUrl,
  actionPlanUrl,
  footerNote
}: FireAssessmentEmailProps) => {
  const assessmentDetails: Record<string, string> = {};
  if (assessmentType) assessmentDetails['Type'] = assessmentType;
  if (dueDate) assessmentDetails['Due Date'] = dueDate;
  if (assessor) assessmentDetails['Assessor'] = assessor;
  if (riskLevel) assessmentDetails['Risk Level'] = riskLevel.toUpperCase();

  const getRiskVariant = (level?: string) => {
    switch(level) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'info';
    }
  };

  const emailContent = (
    <Section className="p-8">
      {recipientName && (
        <Text className="mb-5 text-gray-700">
          Hello {recipientName},
        </Text>
      )}
      
      <Heading as="h1" className="text-gray-900 mb-5 text-2xl font-bold">
        📊 {assessmentTitle}
      </Heading>
      
      <Text className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
        {assessmentMessage}
      </Text>
      
      {/* Assessment Details */}
      {Object.keys(assessmentDetails).length > 0 && (
        <DetailsList
          title="Assessment Details"
          details={assessmentDetails}
          backgroundColor="bg-purple-50"
          borderColor={primaryColor}
          textColor="text-purple-700"
        />
      )}
      
      {/* Risk Level Alert */}
      {riskLevel && (
        <AlertSection
          title={`Risk Level: ${riskLevel.toUpperCase()}`}
          message={`This assessment has identified a ${riskLevel} risk level that requires attention.`}
          variant={getRiskVariant(riskLevel)}
        />
      )}
      
      {/* Risk Findings */}
      {riskFindings && riskFindings.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-red-700">
            Risk Findings
          </Heading>
          <ul className="m-0 pl-5">
            {riskFindings.map((finding, index) => (
              <li key={index} className="mb-1">{finding}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Immediate Actions */}
      {immediateActions && immediateActions.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-orange-700">
            Immediate Actions Required
          </Heading>
          {actionDeadline && (
            <Text className="m-0 mb-2 font-semibold text-orange-700">
              Deadline: {actionDeadline}
            </Text>
          )}
          <ul className="m-0 pl-5">
            {immediateActions.map((action, index) => (
              <li key={index} className="mb-1">{action}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-green-50 border border-green-300 rounded p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-green-700">
            Recommendations
          </Heading>
          <ul className="m-0 pl-5">
            {recommendations.map((rec, index) => (
              <li key={index} className="mb-1">{rec}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Compliance Status */}
      {complianceStatus && Object.keys(complianceStatus).length > 0 && (
        <DetailsList
          title="Compliance Status"
          details={complianceStatus}
          backgroundColor="bg-gray-50"
          borderColor="#9E9E9E"
          textColor="text-gray-700"
        />
      )}
      
      {/* Action Buttons */}
      {reportUrl && (
        <ActionButton
          text="View Full Report"
          url={reportUrl}
          backgroundColor={primaryColor}
          sectionClassName="text-center my-6"
        />
      )}
      
      {actionPlanUrl && (
        <ActionButton
          text="Create Action Plan"
          url={actionPlanUrl}
          backgroundColor="#FF9800"
          sectionClassName="text-center my-6"
        />
      )}
    </Section>
  );

  return (
    <BasicEmailLayout
      subject={subject}
      organizationName={organizationName}
      logoUrl={logoUrl}
      primaryColor={primaryColor}
      footerNote={footerNote}
      containerStyle="default"
    >
      {emailContent}
    </BasicEmailLayout>
  );
};

export function renderFireAssessmentEmail(props: FireAssessmentEmailProps): string {
  return render(<FireAssessmentEmailComponent {...props} />);
}