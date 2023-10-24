/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useEffect, useRef, useState } from 'react';
import { useNotificationCenter } from 'react-toastify/addons/use-notification-center';

export interface NotificationCenterProps {
  notificationFilter?: string[];
  secondaryFilter?: string;
  placeholder?: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notificationFilter,
  secondaryFilter,
  placeholder,
}) => {
  const { notifications, clear, markAllAsRead, markAsRead, unreadCount } =
    useNotificationCenter();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notificationsRef.current) {
      notificationsRef.current.scrollTop =
        notificationsRef.current.scrollHeight;
    }
  }, [notifications]);
  const toggleFilter = (e: React.ChangeEvent) => {
    setShowUnreadOnly(!showUnreadOnly);
  };

  const filteredNotifications = notificationFilter
    ? notifications.filter((notification) => {
        return notificationFilter.includes(notification.type || '');
      })
    : notifications.filter(
        (notification: any) => notification.data?.type === secondaryFilter,
      );

  return (
    <>
      <div
        className="p-3 bg-base rounded-xl overflow-y-auto w-full flex-grow flex flex-col"
        ref={notificationsRef}
      >
        {(!filteredNotifications.length ||
          (unreadCount === 0 && showUnreadOnly)) && (
          <p className="text-acai-white text-sm">{placeholder}</p>
        )}
        {(showUnreadOnly
          ? filteredNotifications.filter((v) => !v.read)
          : filteredNotifications
        )
          .reverse()
          .map((notification) => {
            return (
              <div
                key={notification.id}
                className={`alert alert-${
                  notification.type || 'info'
                } flex justify-between items-center text-acai-white mb-2 py-2 border-b border-solid border-light`}
              >
                <span>{notification.content as any}</span>
                {/* {notification.read ? '✅' : <span onClick={() => markAsRead(notification.id)}>📬</span>} */}
              </div>
            );
          })}
      </div>
    </>
  );
};

export default NotificationCenter;
