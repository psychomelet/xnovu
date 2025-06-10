"use client";

import { Novu } from "@novu/js";
import { useEffect, useState, useMemo } from "react";
import { Inbox } from "@novu/nextjs";
import styles from "./Notifications.module.css";

const NotificationToast = () => {
  const novu = useMemo(
    () => {
      const config: any = {
        subscriberId: process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID || "",
        applicationIdentifier: process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER || "",
      };

      return new Novu(config);
    },
    []
  );

  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const listener = ({ result: notification }: { result: any }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("Received notification:", notification);
      }
      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
      }, 2500);
    };

    if (process.env.NODE_ENV === 'development') {
      console.log("Setting up Novu notification listener");
    }
    novu.on("notifications.notification_received", listener);

    return () => {
      novu.off("notifications.notification_received", listener);
    };
  }, [novu]);

  if (!showToast) return null;

  return (
    <div className={styles.toast}>
      <div className={styles.toastContent}>New In-App Notification</div>
    </div>
  );
};

export default NotificationToast;

export function NovuInbox() {
  const novuConfig = useMemo(() => {
    const config: any = {
      applicationIdentifier: process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER || "",
      subscriberId: process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID || "",
      appearance: {
        elements: {
          bellContainer: {
            width: "30px",
            height: "30px",
          },
          bellIcon: {
            width: "30px",
            height: "30px",
          },
        },
      },
    };

    return config;
  }, []);

  return <Inbox {...novuConfig} />;
}
