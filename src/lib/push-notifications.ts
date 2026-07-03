"use client";

import { getToken, deleteToken } from "firebase/messaging";
import { getFirebaseMessaging } from "./firebase-client";

export async function registerFirebaseServiceWorker() {
  if (typeof window === "undefined" || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

export async function getFcmToken() {
  if (typeof window === "undefined") {
    throw new Error('Web push is not available on the server.');
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error('Firebase messaging is not configured or not supported in this browser.');
  }

  const registration = await navigator.serviceWorker.ready;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;
  const token = await getToken(messaging, {
    serviceWorkerRegistration: registration,
    vapidKey,
  });

  if (!token) {
    throw new Error('Failed to obtain FCM token.');
  }

  return token;
}

export async function subscribeToPushNotifications() {
  if (typeof window === "undefined" || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission denied for notifications.');
  }

  await registerFirebaseServiceWorker();
  return getFcmToken();
}

export async function unsubscribeFromPushNotifications() {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error('Firebase messaging is not configured or not supported in this browser.');
  }
  return deleteToken(messaging);
}

export function getCurrentPushPermission() {
  if (typeof window === "undefined" || !('Notification' in window)) {
    return 'default';
  }

  return Notification.permission;
}
