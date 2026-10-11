/**
 * Pusher Beams Push Notification Helper
 */

export const sendPushNotification = async ({
  interests = ['hello'],
  title,
  body,
  deepLink = null,
  icon = '/images/logo/vyapar-sakha-version2-logo.svg',
}) => {
  const instanceId = process.env.PUSHER_BEAMS_INSTANCE_ID;
  const secretKey = process.env.PUSHER_BEAMS_SECRET_KEY;

  if (!instanceId || !secretKey) {
    console.warn('[Pusher Beams] PUSHER_BEAMS_INSTANCE_ID or PUSHER_BEAMS_SECRET_KEY not set.');
    return null;
  }

  if (!interests || !interests.length) {
    return null;
  }

  try {
    const url = `https://${instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${instanceId}/publishes`;

    const isAbsoluteUri = typeof icon === 'string' && (icon.startsWith('http://') || icon.startsWith('https://'));

    const notificationPayload = {
      title: title || 'Vyapar Sathi Alert',
      body: body || 'You have a new update.',
    };

    if (isAbsoluteUri) {
      notificationPayload.icon = icon;
    }

    if (deepLink && (deepLink.startsWith('http://') || deepLink.startsWith('https://'))) {
      notificationPayload.deep_link = deepLink;
    }

    const payload = {
      interests,
      web: {
        notification: notificationPayload,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Pusher Beams] Publish failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('[Pusher Beams] Push sent successfully, publishId:', data.publishId);
    return data;
  } catch (error) {
    console.error('[Pusher Beams] Error sending push notification:', error.message);
    return null;
  }
};
