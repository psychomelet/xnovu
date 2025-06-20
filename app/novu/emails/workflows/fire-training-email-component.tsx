import React from "react";
import { render, Section, Text, Heading } from "@react-email/components";
import { BasicEmailLayout } from "../layouts";
import { InfoSection, DetailsList, ActionButton, SafetyReminders } from "../components";

export interface FireTrainingEmailProps {
  subject: string;
  recipientName?: string;
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
  
  // Training details
  trainingTitle: string;
  trainingMessage: string;
  trainingDate?: string;
  trainingLocation?: string;
  trainingDuration?: string;
  
  // Instructions
  instructions?: string;
  requirements?: string[];
  
  // Additional details
  trainerInfo?: Record<string, string>;
  trainingMaterials?: string[];
  
  // Actions
  registrationUrl?: string;
  confirmationUrl?: string;
  
  // Footer
  footerNote?: string;
}

export const FireTrainingEmailComponent = ({
  subject,
  recipientName,
  organizationName,
  logoUrl,
  primaryColor = '#FF9800',
  trainingTitle,
  trainingMessage,
  trainingDate,
  trainingLocation,
  trainingDuration,
  instructions,
  requirements,
  trainerInfo,
  trainingMaterials,
  registrationUrl,
  confirmationUrl,
  footerNote
}: FireTrainingEmailProps) => {
  const trainingDetails: Record<string, string> = {};
  if (trainingDate) trainingDetails['Date & Time'] = trainingDate;
  if (trainingLocation) trainingDetails['Location'] = trainingLocation;
  if (trainingDuration) trainingDetails['Duration'] = trainingDuration;

  const emailContent = (
    <Section className="p-8">
      {recipientName && (
        <Text className="mb-5 text-gray-700">
          Hello {recipientName},
        </Text>
      )}
      
      <Heading as="h1" className="text-gray-900 mb-5 text-2xl font-bold">
        🔥 {trainingTitle}
      </Heading>
      
      <Text className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
        {trainingMessage}
      </Text>
      
      {/* Training Details */}
      {Object.keys(trainingDetails).length > 0 && (
        <DetailsList
          title="Training Details"
          details={trainingDetails}
          backgroundColor="bg-orange-50"
          borderColor={primaryColor}
          textColor="text-orange-700"
        />
      )}
      
      {/* Instructions */}
      {instructions && (
        <InfoSection
          title="Instructions"
          content={instructions}
          backgroundColor="bg-blue-50"
          borderColor="#2196F3"
          textColor="text-blue-700"
          borderVariant="left"
        />
      )}
      
      {/* Requirements */}
      {requirements && requirements.length > 0 && (
        <SafetyReminders
          title="Requirements"
          reminders={requirements}
          backgroundColor="bg-yellow-50"
          borderColor="#FFC107"
          textColor="text-yellow-700"
        />
      )}
      
      {/* Trainer Information */}
      {trainerInfo && Object.keys(trainerInfo).length > 0 && (
        <DetailsList
          title="Trainer Information"
          details={trainerInfo}
          backgroundColor="bg-green-50"
          borderColor="#4CAF50"
          textColor="text-green-700"
        />
      )}
      
      {/* Training Materials */}
      {trainingMaterials && trainingMaterials.length > 0 && (
        <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-gray-700">
            Training Materials
          </Heading>
          <ul className="m-0 pl-5">
            {trainingMaterials.map((material, index) => (
              <li key={index} className="mb-1">{material}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Action Buttons */}
      {registrationUrl && (
        <ActionButton
          text="Register for Training"
          url={registrationUrl}
          backgroundColor={primaryColor}
          sectionClassName="text-center my-6"
        />
      )}
      
      {confirmationUrl && (
        <ActionButton
          text="Confirm Attendance"
          url={confirmationUrl}
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

export async function renderFireTrainingEmail(props: FireTrainingEmailProps): Promise<string> {
  return await render(<FireTrainingEmailComponent {...props} />);
}