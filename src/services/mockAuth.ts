// Mock Authentication Service for Local Development
// This bypasses Firebase to test the app locally

export interface MockUser {
  uid: string;
  email: string;
  displayName?: string;
}

let currentUser: MockUser | null = null;
let authListeners: ((user: MockUser | null) => void)[] = [];

export const mockSignIn = async (email: string, password: string): Promise<MockUser> => {
  console.log('Mock signIn called with:', email, password);
  
  // Simple mock authentication - accept any email/password
  const user: MockUser = {
    uid: 'mock-user-' + Date.now(),
    email: email,
    displayName: email.split('@')[0]
  };
  
  currentUser = user;
  console.log('Mock authentication successful:', user);
  
  // Notify all listeners about the new user
  authListeners.forEach(listener => listener(user));
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return user;
};

export const mockSignOut = async (): Promise<void> => {
  console.log('Mock signOut called');
  currentUser = null;
  
  // Notify all listeners about the user logout
  authListeners.forEach(listener => listener(null));
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
};

export const mockGetCurrentUser = (): MockUser | null => {
  return currentUser;
};

export const mockOnAuthStateChange = (callback: (user: MockUser | null) => void) => {
  console.log('Mock auth state listener set up');
  
  // Add this listener to our list
  authListeners.push(callback);
  
  // Immediately call with current user
  callback(currentUser);
  
  // Return unsubscribe function
  return () => {
    console.log('Mock auth state listener removed');
    // Remove this listener from our list
    const index = authListeners.indexOf(callback);
    if (index > -1) {
      authListeners.splice(index, 1);
    }
  };
};
