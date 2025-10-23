import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';

export function useFirestoreDoc<T>(docPath: string, defaultValue: T) {
  const { user } = useAuth();
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setData(defaultValue);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', user.uid, docPath);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.data() as T);
      } else {
        // Document doesn't exist yet, use default and create it
        setDoc(docRef, defaultValue).catch(console.error);
        setData(defaultValue);
      }
      setLoading(false);
    }, (error) => {
      console.error(`Error loading ${docPath}:`, error);
      setData(defaultValue);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, docPath]);

  const update = async (updates: Partial<T>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, docPath);
      const newData = { ...data, ...updates };
      await setDoc(docRef, newData);
      setData(newData);
    } catch (error) {
      console.error(`Error updating ${docPath}:`, error);
      throw error;
    }
  };

  return { data, loading, update };
}
