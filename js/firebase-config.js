// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQb2n55TNT5W_INtvl_f1A3vU8h4X48jI",
  authDomain: "projectdemo-24a30.firebaseapp.com",
  databaseURL: "https://projectdemo-24a30.firebaseio.com",
  projectId: "projectdemo-24a30",
  storageBucket: "projectdemo-24a30.firebasestorage.app",
  messagingSenderId: "980011020752",
  appId: "1:980011020752:web:3eaba731db0cc6ac4509d5"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// บันทึก activity
export async function saveActivityToFirebase(activityData) {
  try {
    const docRef = await addDoc(collection(db, 'activities'), {
      ...activityData,
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving activity:', error);
    throw error;
  }
}

// ดึง activity ทั้งหมด
export async function getAllActivities() {
  try {
    const querySnapshot = await getDocs(collection(db, 'activities'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
}

// ลบ activity
export async function deleteActivityFromFirebase(activityId) {
  try {
    await deleteDoc(doc(db, 'activities', activityId));
  } catch (error) {
    console.error('Error deleting activity:', error);
  }
}
