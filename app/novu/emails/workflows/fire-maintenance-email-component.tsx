import React from "react";
import { render, Section, Text, Heading } from "@react-email/components";
import { BasicEmailLayout } from "../layouts";
import { InfoSection, DetailsList, ActionButton, SafetyReminders } from "../components";

export interface FireMaintenanceEmailProps {
  subject: string;
  recipientName?: string;
  organizationName: string;
  logoUrl?: string;
  primaryColor?: string;
  
  // Maintenance details
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceType?: string;
  scheduledDate?: string;
  estimatedDuration?: string;
  technician?: string;
  technicianContact?: string;
  
  // Equipment details
  equipmentList?: string[];
  affectedAreas?: string[];
  
  // Safety considerations
  safetyNotes?: string[];
  accessRequirements?: string[];
  
  // Building/location details
  locationDetails?: Record<string, string>;
  
  // During maintenance
  temporaryProcedures?: string[];
  backupSystems?: Record<string, string>;
  
  // Actions
  scheduleUrl?: string;
  workOrderUrl?: string;
  
  // Footer
  footerNote?: string;
}

export const FireMaintenanceEmailComponent = ({
  subject,
  recipientName,
  organizationName,
  logoUrl,
  primaryColor = '#607D8B',
  maintenanceTitle,
  maintenanceMessage,
  maintenanceType,
  scheduledDate,
  estimatedDuration,
  technician,
  technicianContact,
  equipmentList,
  affectedAreas,
  safetyNotes,
  accessRequirements,
  locationDetails,
  temporaryProcedures,
  backupSystems,
  scheduleUrl,
  workOrderUrl,
  footerNote
}: FireMaintenanceEmailProps) => {
  const maintenanceDetails: Record<string, string> = {};
  if (maintenanceType) maintenanceDetails['Type'] = maintenanceType;
  if (scheduledDate) maintenanceDetails['Scheduled Date'] = scheduledDate;
  if (estimatedDuration) maintenanceDetails['Duration'] = estimatedDuration;
  if (technician) maintenanceDetails['Technician'] = technician;
  if (technicianContact) maintenanceDetails['Contact'] = technicianContact;

  const emailContent = (
    <Section className="p-8">
      {recipientName && (
        <Text className="mb-5 text-gray-700">
          Hello {recipientName},
        </Text>
      )}
      
      <Heading as="h1" className="text-gray-900 mb-5 text-2xl font-bold">
        🔧 {maintenanceTitle}
      </Heading>
      
      <Text className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
        {maintenanceMessage}
      </Text>
      
      {/* Maintenance Details */}
      {Object.keys(maintenanceDetails).length > 0 && (
        <DetailsList
          title="Maintenance Details"
          details={maintenanceDetails}
          backgroundColor="bg-blue-50"
          borderColor={primaryColor}
          textColor="text-blue-700"
        />
      )}
      
      {/* Location Details */}
      {locationDetails && Object.keys(locationDetails).length > 0 && (
        <DetailsList
          title="Location Information"
          details={locationDetails}
        />
      )}
      
      {/* Equipment List */}
      {equipmentList && equipmentList.length > 0 && (
        <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-gray-700">
            Equipment to be Serviced
          </Heading>
          <ul className="m-0 pl-5">
            {equipmentList.map((equipment, index) => (
              <li key={index} className="mb-1">{equipment}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Affected Areas */}
      {affectedAreas && affectedAreas.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-yellow-700">
            Affected Areas
          </Heading>
          <ul className="m-0 pl-5">
            {affectedAreas.map((area, index) => (
              <li key={index} className="mb-1">{area}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Safety Considerations */}
      {safetyNotes && safetyNotes.length > 0 && (
        <SafetyReminders
          title="Safety Considerations"
          reminders={safetyNotes}
          backgroundColor="bg-red-50"
          borderColor="#F44336"
          textColor="text-red-700"
        />
      )}
      
      {/* Access Requirements */}
      {accessRequirements && accessRequirements.length > 0 && (
        <InfoSection
          title="Access Requirements"
          content={accessRequirements.join('\n')}
          backgroundColor="bg-purple-50"
          borderColor="#9C27B0"
          textColor="text-purple-700"
          borderVariant="left"
        />
      )}
      
      {/* Temporary Procedures */}
      {temporaryProcedures && temporaryProcedures.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-5">
          <Heading as="h3" className="m-0 mb-2 text-orange-700">
            Temporary Procedures During Maintenance
          </Heading>
          <ul className="m-0 pl-5">
            {temporaryProcedures.map((procedure, index) => (
              <li key={index} className="mb-1">{procedure}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Backup Systems */}
      {backupSystems && Object.keys(backupSystems).length > 0 && (
        <DetailsList
          title="Backup Systems"
          details={backupSystems}
          backgroundColor="bg-green-50"
          borderColor="#4CAF50"
          textColor="text-green-700"
        />
      )}
      
      {/* Action Buttons */}
      {scheduleUrl && (
        <ActionButton
          text="Confirm Schedule"
          url={scheduleUrl}
          backgroundColor={primaryColor}
          sectionClassName="text-center my-6"
        />
      )}
      
      {workOrderUrl && (
        <ActionButton
          text="View Work Order"
          url={workOrderUrl}
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

export async function renderFireMaintenanceEmail(props: FireMaintenanceEmailProps): Promise<string> {
  return await render(<FireMaintenanceEmailComponent {...props} />);
}