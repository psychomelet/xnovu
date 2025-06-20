import React from "react";
import { Heading, Text } from "@react-email/components";

interface Contact {
  label: string;
  name: string;
  phone: string;
}

interface ContactListProps {
  title: string;
  contacts: Contact[];
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  linkColor?: string;
  className?: string;
}

export const ContactList = ({
  title,
  contacts,
  backgroundColor = 'bg-orange-50',
  borderColor = '#FB8C00',
  textColor = 'text-orange-700',
  linkColor = '#F57C00',
  className = 'border border-orange-300 rounded p-4 mb-5'
}: ContactListProps) => {
  return (
    <div className={`${backgroundColor} ${className}`}>
      <Heading as="h3" className={`m-0 mb-2 ${textColor}`}>
        {title}
      </Heading>
      {contacts.map((contact, index) => (
        <Text key={index} className="m-0 my-1">
          <strong>{contact.label}:</strong> {contact.name && `${contact.name} - `}
          <a href={`tel:${contact.phone}`} className="ml-1" style={{ color: linkColor }}>
            {contact.phone}
          </a>
        </Text>
      ))}
    </div>
  );
};