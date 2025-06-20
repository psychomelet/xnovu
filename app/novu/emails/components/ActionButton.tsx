import React from "react";
import { Button, Section } from "@react-email/components";

interface ActionButtonProps {
  text: string;
  url: string;
  backgroundColor?: string;
  textColor?: string;
  className?: string;
  sectionClassName?: string;
}

export const ActionButton = ({
  text,
  url,
  backgroundColor = '#0066cc',
  textColor = 'white',
  className = 'px-6 py-3 rounded-md font-semibold no-underline inline-block',
  sectionClassName = 'text-center my-8'
}: ActionButtonProps) => {
  return (
    <Section className={sectionClassName}>
      <Button
        href={url}
        className={`${className}`}
        style={{ backgroundColor, color: textColor }}
      >
        {text}
      </Button>
    </Section>
  );
};