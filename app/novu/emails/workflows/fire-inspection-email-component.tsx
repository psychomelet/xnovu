import React from "react";
import { render, Section, Text, Heading } from "@react-email/components";
import { BasicEmailLayout } from "../layouts";
import { InfoSection, DetailsList, ActionButton } from "../components";

export interface FireInspectionEmailProps {
  subject: string;
  recipientName?: string;
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
  
  // Inspection details
  inspectionTitle: string;
  inspectionMessage: string;
  inspectionDate?: string;
  inspectionTime?: string;
  inspectorName?: string;
  inspectorContact?: string;
  
  // Areas to inspect
  inspectionAreas?: string[];
  requirements?: string[];
  
  // Building/location details
  locationDetails?: Record<string, string>;
  
  // Actions
  scheduleUrl?: string;
  checklistUrl?: string;
  
  // Footer
  footerNote?: string;
}

export const FireInspectionEmailComponent = ({
  subject,
  recipientName,
  organizationName,
  logoUrl,
  primaryColor = '#795548',
  inspectionTitle,
  inspectionMessage,
  inspectionDate,
  inspectionTime,
  inspectorName,
  inspectorContact,
  inspectionAreas,
  requirements,
  locationDetails,
  scheduleUrl,
  checklistUrl,
  footerNote
}: FireInspectionEmailProps) => {
  const inspectionDetails: Record<string, string> = {};
  if (inspectionDate) inspectionDetails['Date'] = inspectionDate;
  if (inspectionTime) inspectionDetails['Time'] = inspectionTime;
  if (inspectorName) inspectionDetails['Inspector'] = inspectorName;
  if (inspectorContact) inspectionDetails['Contact'] = inspectorContact;

  const emailContent = (
    <Section className="p-8">
      {recipientName && (
        <Text className="mb-5 text-gray-700">
          Hello {recipientName},
        </Text>
      )}
      
      <Heading as="h1" className="text-gray-900 mb-5 text-2xl font-bold">
        🔍 {inspectionTitle}
      </Heading>
      
      <Text className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
        {inspectionMessage}
      </Text>
      
      {/* Inspection Details */}
      {Object.keys(inspectionDetails).length > 0 && (
        <DetailsList
          title="Inspection Details"
          details={inspectionDetails}
          backgroundColor="bg-brown-50"
          borderColor={primaryColor}
          textColor="text-brown-700"
        />
      )}
      
      {/* Location Details */}
      {locationDetails && Object.keys(locationDetails).length > 0 && (
        <DetailsList
          title="Location Information"
          details={locationDetails}
        />
      )}
      
      {/* Inspection Areas */}
      {inspectionAreas && inspectionAreas.length > 0 && (
        <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-gray-700">
            Areas to be Inspected
          </Heading>
          <ul className="m-0 pl-5">
            {inspectionAreas.map((area, index) => (
              <li key={index} className="mb-1">{area}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Requirements */}
      {requirements && requirements.length > 0 && (
        <InfoSection
          title="Preparation Requirements"
          content={requirements.join('\n')}
          backgroundColor="bg-yellow-50"
          borderColor="#FFC107"
          textColor="text-yellow-700"
          borderVariant="left"
        />
      )}
      
      {/* Action Buttons */}
      {scheduleUrl && (
        <ActionButton
          text="Schedule Inspection"
          url={scheduleUrl}
          backgroundColor={primaryColor}
          sectionClassName="text-center my-6"
        />
      )}
      
      {checklistUrl && (
        <ActionButton
          text="View Inspection Checklist"
          url={checklistUrl}
          backgroundColor="#4CAF50"
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

export function renderFireInspectionEmail(props: FireInspectionEmailProps): string {
  return render(<FireInspectionEmailComponent {...props} />);
}