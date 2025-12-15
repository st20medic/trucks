import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthContext: Setting up auth state listener');
    
    // Use Firebase authentication
    console.log('AuthContext: Using Firebase authentication');
    const currentUser = auth.currentUser;
    console.log('AuthContext: Current user from auth:', currentUser?.email);
    
    if (currentUser) {
      console.log('AuthContext: Setting current user immediately');
      setUser(currentUser);
      setLoading(false);
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('AuthContext: Auth state changed:', user ? `User ${user.email} logged in` : 'No user');
      setUser(user);
      setLoading(false);
      
      console.log('AuthContext: Current state - user:', user?.email, 'loading:', false, 'isAuthenticated:', !!user);
    });
    
    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
  };

  console.log('AuthContext: Current state - user:', user?.email, 'loading:', loading, 'isAuthenticated:', !!user);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
