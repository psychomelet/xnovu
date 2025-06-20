import React from "react";
import { render, Section, Text } from "@react-email/components";
import { FireSafetyEmailLayout } from "../layouts";
import { AlertSection, InfoSection, ContactList, DetailsList, ActionButton, SafetyReminders } from "../components";

export interface FireEmergencyEmailProps {
  subject: string;
  recipientName?: string;
  organizationName: string;
  logoUrl?: string;
  
  // Emergency header
  urgencyBadge?: string;
  emergencyTitle: string;
  emergencySubtitle?: string;
  emergencyColor: string;
  
  // Alert section
  alertTitle: string;
  alertMessage: string;
  alertColor?: string;
  
  // Instructions section
  instructionsTitle: string;
  instructionsContent: string;
  additionalInstructions?: string;
  
  // Safety reminders
  safetyReminders?: string[];
  
  // Details sections
  locationDetails?: Record<string, string>;
  emergencyContacts?: Array<{ label: string; name: string; phone: string }>;
  
  // Maps and resources
  evacuationMapUrl?: string;
  
  // Actions
  acknowledgmentUrl?: string;
  alertId?: string;
  
  // Metadata
  reportedBy?: string;
  severity?: string;
  detectedAt?: string;
  
  // Footer
  footerNote?: string;
}

export const FireEmergencyEmailComponent = ({
  subject,
  recipientName,
  organizationName,
  logoUrl,
  urgencyBadge,
  emergencyTitle,
  emergencySubtitle,
  emergencyColor,
  alertTitle,
  alertMessage,
  alertColor = '#D32F2F',
  instructionsTitle,
  instructionsContent,
  additionalInstructions,
  safetyReminders,
  locationDetails,
  emergencyContacts,
  evacuationMapUrl,
  acknowledgmentUrl,
  alertId,
  reportedBy,
  severity,
  detectedAt,
  footerNote,
}: FireEmergencyEmailProps) => {
  const emailContent = (
    <Section className="p-8">
      {recipientName && (
        <Text className="mb-5 text-gray-700">
          Dear {recipientName},
        </Text>
      )}
      
      {/* Alert Section */}
      <AlertSection
        title={alertTitle}
        message={alertMessage}
        color={alertColor}
        variant="danger"
      />
      
      {/* Instructions Section */}
      <InfoSection
        title={instructionsTitle}
        content={instructionsContent}
        backgroundColor="bg-orange-50"
        borderColor="#FB8C00"
        textColor="text-orange-700"
        borderVariant="left"
      />
      
      {additionalInstructions && (
        <Text className="mb-5 whitespace-pre-wrap">
          {additionalInstructions}
        </Text>
      )}
      
      {/* Safety Reminders */}
      {safetyReminders && safetyReminders.length > 0 && (
        <SafetyReminders reminders={safetyReminders} />
      )}
      
      {/* Location Details */}
      {locationDetails && Object.keys(locationDetails).length > 0 && (
        <DetailsList
          title="Location Details"
          details={locationDetails}
        />
      )}
      
      {/* Emergency Contacts */}
      {emergencyContacts && emergencyContacts.length > 0 && (
        <ContactList
          title="Emergency Contacts"
          contacts={emergencyContacts}
        />
      )}
      
      {/* Evacuation Map */}
      {evacuationMapUrl && (
        <div className="bg-gray-100 border-l-4 p-4 mb-5" style={{ borderLeftColor: emergencyColor }}>
          <Text className="m-0 mb-2 font-semibold" style={{ color: emergencyColor }}>
            Evacuation Map
          </Text>
          <a 
            href={evacuationMapUrl} 
            target="_blank" 
            className="underline"
            style={{ color: emergencyColor }}
          >
            View Building Evacuation Map
          </a>
        </div>
      )}
      
      {/* Acknowledgment Button */}
      {acknowledgmentUrl && alertId && (
        <ActionButton
          text="Acknowledge Receipt"
          url={`${acknowledgmentUrl}?alertId=${alertId}`}
          backgroundColor={emergencyColor}
        />
      )}
      
      {/* Alert Information */}
      {(alertId || reportedBy || severity || detectedAt) && (
        <div className="mt-8 p-4 bg-gray-100 rounded text-xs text-gray-600">
          {alertId && <Text className="m-0 my-1"><strong>Alert ID:</strong> {alertId}</Text>}
          {reportedBy && <Text className="m-0 my-1"><strong>Reported by:</strong> {reportedBy}</Text>}
          {severity && <Text className="m-0 my-1"><strong>Severity:</strong> {severity.toUpperCase()}</Text>}
          {detectedAt && <Text className="m-0 my-1"><strong>Detected at:</strong> {detectedAt}</Text>}
        </div>
      )}
    </Section>
  );

  return (
    <FireSafetyEmailLayout
      subject={subject}
      organizationName={organizationName}
      logoUrl={logoUrl}
      emergencyColor={emergencyColor}
      urgencyBadge={urgencyBadge}
      emergencyTitle={emergencyTitle}
      emergencySubtitle={emergencySubtitle}
      footerNote={footerNote}
    >
      {emailContent}
    </FireSafetyEmailLayout>
  );
};

export async function renderFireEmergencyEmail(props: FireEmergencyEmailProps): Promise<string> {
  return await render(<FireEmergencyEmailComponent {...props} />);
}