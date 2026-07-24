import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Use a service account JSON (set FIREBASE_SERVICE_ACCOUNT env var as the full JSON string)
// OR use individual env vars for each field.
function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  // Fallback: individual env vars
  return cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  });
}

if (!getApps().length) {
  initializeApp({ credential: getCredential() });
}

const db = getFirestore();

export { db };
