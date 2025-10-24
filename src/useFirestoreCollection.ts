import { useEffect, useState } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';

export function useFirestoreCollection<T>(collectionName: string) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    // Listen to user's collection in real-time
    const q = query(collection(db, 'users', user.uid, collectionName));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Remove any 'id' field from the data and use Firestore's doc.id instead
        const { id: _, ...dataWithoutId } = data as any;
        items.push({ id: doc.id, ...dataWithoutId } as T);
      });
      console.log(`Firestore snapshot update for ${collectionName}:`, items.length, 'items');
      setData(items);
      setLoading(false);
    }, (error) => {
      console.error(`Error loading ${collectionName}:`, error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, collectionName]);

  const add = async (item: Omit<T, 'id'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, collectionName), item);
    } catch (error) {
      console.error(`Error adding to ${collectionName}:`, error);
      throw error;
    }
  };

  const update = async (id: string, updates: Partial<T>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, collectionName, id);
      await updateDoc(docRef, updates as any);
    } catch (error) {
      console.error(`Error updating ${collectionName}:`, error);
      throw error;
    }
  };

  const remove = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
    } catch (error) {
      console.error(`Error deleting from ${collectionName}:`, error);
      throw error;
    }
  };

  const set = async (id: string, item: Omit<T, 'id'>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, collectionName, id);
      await setDoc(docRef, item);
    } catch (error) {
      console.error(`Error setting ${collectionName}:`, error);
      throw error;
    }
  };

  return { data, loading, add, update, remove, set };
}
