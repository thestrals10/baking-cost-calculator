import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDtf7_ek5gVI-bx0tUXLQvRz6mZcKfcjf4",
  authDomain: "baking-cost--calculator.firebaseapp.com",
  projectId: "baking-cost--calculator",
  storageBucket: "baking-cost--calculator.firebasestorage.app",
  messagingSenderId: "1002835611925",
  appId: "1:1002835611925:web:1b62e632dcd816dfa8d91c",
  measurementId: "G-FBH2N5Q4PG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
