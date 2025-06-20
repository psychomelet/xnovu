import React from "react";
import { render, Section, Text, Heading } from "@react-email/components";
import { BasicEmailLayout } from "../layouts";
import { AlertSection, InfoSection, DetailsList, ActionButton, SafetyReminders } from "../components";

export interface FireDrillEmailProps {
  subject: string;
  recipientName?: string;
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
  
  // Drill details
  drillTitle: string;
  drillMessage: string;
  drillDate?: string;
  drillTime?: string;
  estimatedDuration?: string;
  
  // Assembly and evacuation
  assemblyPoint?: string;
  evacuationRoute?: string;
  
  // Instructions
  beforeDrillInstructions?: string[];
  duringDrillInstructions?: string[];
  afterDrillInstructions?: string[];
  
  // Building details
  buildingDetails?: Record<string, string>;
  
  // Actions
  acknowledgmentUrl?: string;
  evacuationMapUrl?: string;
  
  // Footer
  footerNote?: string;
}

export const FireDrillEmailComponent = ({
  subject,
  recipientName,
  organizationName,
  logoUrl,
  primaryColor = '#2196F3',
  drillTitle,
  drillMessage,
  drillDate,
  drillTime,
  estimatedDuration,
  assemblyPoint,
  evacuationRoute,
  beforeDrillInstructions,
  duringDrillInstructions,
  afterDrillInstructions,
  buildingDetails,
  acknowledgmentUrl,
  evacuationMapUrl,
  footerNote
}: FireDrillEmailProps) => {
  const drillDetails: Record<string, string> = {};
  if (drillDate) drillDetails['Date'] = drillDate;
  if (drillTime) drillDetails['Time'] = drillTime;
  if (estimatedDuration) drillDetails['Duration'] = estimatedDuration;
  if (assemblyPoint) drillDetails['Assembly Point'] = assemblyPoint;
  if (evacuationRoute) drillDetails['Evacuation Route'] = evacuationRoute;

  const emailContent = (
    <Section className="p-8">
      {recipientName && (
        <Text className="mb-5 text-gray-700">
          Hello {recipientName},
        </Text>
      )}
      
      <Heading as="h1" className="text-gray-900 mb-5 text-2xl font-bold">
        🚨 {drillTitle}
      </Heading>
      
      <Text className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
        {drillMessage}
      </Text>
      
      {/* Drill Alert */}
      <AlertSection
        title="Scheduled Fire Drill"
        message="This is a planned drill to ensure everyone knows the evacuation procedures."
        variant="info"
      />
      
      {/* Drill Details */}
      {Object.keys(drillDetails).length > 0 && (
        <DetailsList
          title="Drill Information"
          details={drillDetails}
        />
      )}
      
      {/* Building Details */}
      {buildingDetails && Object.keys(buildingDetails).length > 0 && (
        <DetailsList
          title="Building Information"
          details={buildingDetails}
          backgroundColor="bg-gray-50"
          borderColor="#9E9E9E"
          textColor="text-gray-700"
        />
      )}
      
      {/* Instructions */}
      {beforeDrillInstructions && beforeDrillInstructions.length > 0 && (
        <SafetyReminders
          title="Before the Drill"
          reminders={beforeDrillInstructions}
          backgroundColor="bg-blue-50"
          borderColor="#2196F3"
          textColor="text-blue-700"
        />
      )}
      
      {duringDrillInstructions && duringDrillInstructions.length > 0 && (
        <SafetyReminders
          title="During the Drill"
          reminders={duringDrillInstructions}
          backgroundColor="bg-orange-50"
          borderColor="#FF9800"
          textColor="text-orange-700"
        />
      )}
      
      {afterDrillInstructions && afterDrillInstructions.length > 0 && (
        <SafetyReminders
          title="After the Drill"
          reminders={afterDrillInstructions}
          backgroundColor="bg-green-50"
          borderColor="#4CAF50"
          textColor="text-green-700"
        />
      )}
      
      {/* Action Buttons */}
      {evacuationMapUrl && (
        <ActionButton
          text="View Evacuation Map"
          url={evacuationMapUrl}
          backgroundColor={primaryColor}
          sectionClassName="text-center my-6"
        />
      )}
      
      {acknowledgmentUrl && (
        <ActionButton
          text="Acknowledge Understanding"
          url={acknowledgmentUrl}
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

export function renderFireDrillEmail(props: FireDrillEmailProps): string {
  return render(<FireDrillEmailComponent {...props} />);
}