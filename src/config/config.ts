// Configuration file to switch between mock and Firebase services
export const config = {
  useMockServices: false, // Set to false to use Firebase services
  firebase: {
    projectId: 'trucks-b1a56', // Updated to match your new project
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  }
};

export const shouldUseMockServices = () => {
  // Check if we should use mock services
  return config.useMockServices || !import.meta.env.VITE_FIREBASE_API_KEY;
};
